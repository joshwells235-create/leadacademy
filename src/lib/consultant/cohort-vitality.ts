import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type CohortVitality = {
  learnerCount: number;
  /** Learners who've logged ≥1 action in the last 14 days. */
  activeLast14d: number;
  /** Learners with at least one active goal_sprint. */
  withActiveSprint: number;
  /** Learners with ≥3 assessment docs in "ready" state. */
  assessmentsComplete: number;
  /** Learners with a capstone outline in any non-draft state, or finalized. */
  capstoneShared: number;
  capstoneFinalized: number;
  /** Learners with no active coach_assignment. */
  withoutCoach: number;
  /** Reflections logged in last 30 days across the cohort. */
  reflectionsLast30d: number;
  /** Top 8 reflection themes across the cohort in last 30 days with counts. */
  topThemes: { theme: string; count: number }[];
};

const ACTIVE_DAYS = 14;
const THEMES_DAYS = 30;

/**
 * Aggregate vitality stats for a cohort — the cohort-level view a
 * consultant needs to triage which cohort (of several) deserves
 * attention today. All queries are scoped to the given learner IDs so
 * RLS enforces access; the caller has already filtered to effective-
 * consultant learners if appropriate.
 */
export async function getCohortVitality(
  supabase: SupabaseClient<Database>,
  learnerIds: string[],
): Promise<CohortVitality> {
  if (learnerIds.length === 0) {
    return {
      learnerCount: 0,
      activeLast14d: 0,
      withActiveSprint: 0,
      assessmentsComplete: 0,
      capstoneShared: 0,
      capstoneFinalized: 0,
      withoutCoach: 0,
      reflectionsLast30d: 0,
      topThemes: [],
    };
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - ACTIVE_DAYS);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - THEMES_DAYS);
  const fourteenIso = fourteenDaysAgo.toISOString().slice(0, 10);
  const thirtyIso = thirtyDaysAgo.toISOString().slice(0, 10);

  const [
    recentActionsRes,
    activeSprintsRes,
    assessmentDocsRes,
    capstoneRes,
    coachAssignmentsRes,
    reflectionsRes,
  ] = await Promise.all([
    supabase
      .from("action_logs")
      .select("user_id")
      .in("user_id", learnerIds)
      .gte("occurred_on", fourteenIso),
    supabase
      .from("goal_sprints")
      .select("user_id")
      .in("user_id", learnerIds)
      .eq("status", "active"),
    supabase
      .from("assessments")
      .select("user_id, assessment_documents(status)")
      .in("user_id", learnerIds),
    supabase.from("capstone_outlines").select("user_id, status").in("user_id", learnerIds),
    supabase
      .from("coach_assignments")
      .select("learner_user_id")
      .in("learner_user_id", learnerIds)
      .is("active_to", null),
    supabase
      .from("reflections")
      .select("user_id, themes, reflected_on")
      .in("user_id", learnerIds)
      .gte("reflected_on", thirtyIso),
  ]);

  const activeSet = new Set<string>();
  for (const a of recentActionsRes.data ?? []) activeSet.add(a.user_id);

  const sprintSet = new Set<string>();
  for (const s of activeSprintsRes.data ?? []) sprintSet.add(s.user_id);

  const assessmentsCompleteSet = new Set<string>();
  type AssessmentRow = {
    user_id: string;
    assessment_documents: { status: string }[] | null;
  };
  for (const a of (assessmentDocsRes.data ?? []) as AssessmentRow[]) {
    const readyCount = (a.assessment_documents ?? []).filter((d) => d.status === "ready").length;
    if (readyCount >= 3) assessmentsCompleteSet.add(a.user_id);
  }

  let capstoneShared = 0;
  let capstoneFinalized = 0;
  for (const c of capstoneRes.data ?? []) {
    if (c.status === "finalized") capstoneFinalized += 1;
    else if (c.status === "shared") capstoneShared += 1;
  }

  const withCoachSet = new Set<string>();
  for (const a of coachAssignmentsRes.data ?? []) withCoachSet.add(a.learner_user_id);
  const withoutCoach = learnerIds.filter((id) => !withCoachSet.has(id)).length;

  const themeCounts = new Map<string, number>();
  let reflectionsLast30d = 0;
  for (const r of reflectionsRes.data ?? []) {
    reflectionsLast30d += 1;
    for (const t of r.themes ?? []) {
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
  }
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme, count]) => ({ theme, count }));

  return {
    learnerCount: learnerIds.length,
    activeLast14d: activeSet.size,
    withActiveSprint: sprintSet.size,
    assessmentsComplete: assessmentsCompleteSet.size,
    capstoneShared,
    capstoneFinalized,
    withoutCoach,
    reflectionsLast30d,
    topThemes,
  };
}
