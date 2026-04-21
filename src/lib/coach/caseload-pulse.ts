import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const QUIET_DAYS = 14;
const OVERDUE_RECAP_DAYS = 14;
const NEW_ASSIGNMENT_DAYS = 21;

export type PriorityItemKind =
  | "flagged_question"
  | "overdue_action_items"
  | "overdue_recap"
  | "quiet_coachee"
  | "new_assignment";

export type PriorityItem = {
  /** Stable key; safe for React list keys. */
  id: string;
  kind: PriorityItemKind;
  learnerId: string;
  learnerName: string;
  title: string;
  detail: string;
  urgency: "high" | "medium" | "low";
};

export type CaseloadPulse = {
  activeCoachees: number;
  withActiveSprint: number;
  quietCount: number;
  flaggedQuestionsWaiting: number;
  overdueActionItems: number;
  overdueRecapCount: number;
  newAssignments: number;
  priorityItems: PriorityItem[];
};

/**
 * Assemble caseload-level vitality + a priority queue for Coaching Home.
 *
 * Priority ordering (high → low):
 *   1. Flagged questions waiting on a coach response.
 *   2. Overdue action items the coach assigned.
 *   3. Coachees on an active sprint with no recap in 14+ days.
 *   4. Coachees who have gone quiet (no action / reflection / conversation) 14+ days.
 *   5. New assignments without a recap yet.
 *
 * A single coachee can produce multiple rows — e.g. "Maria has flagged
 * questions waiting" and "Maria has overdue action items" — and the coach
 * decides the priority. We dedupe only within a single `kind`.
 */
export async function getCaseloadPulse(
  supabase: SupabaseClient<Database>,
  coachUserId: string,
): Promise<CaseloadPulse> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const quietCutoff = new Date(today);
  quietCutoff.setDate(today.getDate() - QUIET_DAYS);
  const quietCutoffIso = quietCutoff.toISOString().slice(0, 10);
  const quietCutoffTs = quietCutoff.toISOString();
  const recapCutoff = new Date(today);
  recapCutoff.setDate(today.getDate() - OVERDUE_RECAP_DAYS);
  const recapCutoffIso = recapCutoff.toISOString().slice(0, 10);
  const newAssignmentCutoff = new Date(today);
  newAssignmentCutoff.setDate(today.getDate() - NEW_ASSIGNMENT_DAYS);
  const newAssignmentCutoffIso = newAssignmentCutoff.toISOString().slice(0, 10);

  const { data: assignments } = await supabase
    .from("coach_assignments")
    .select("learner_user_id, active_from")
    .eq("coach_user_id", coachUserId)
    .is("active_to", null);

  const learnerIds = Array.from(new Set((assignments ?? []).map((a) => a.learner_user_id)));
  if (learnerIds.length === 0) {
    return {
      activeCoachees: 0,
      withActiveSprint: 0,
      quietCount: 0,
      flaggedQuestionsWaiting: 0,
      overdueActionItems: 0,
      overdueRecapCount: 0,
      newAssignments: 0,
      priorityItems: [],
    };
  }

  const [
    profilesRes,
    activeSprintsRes,
    flaggedQsRes,
    overdueItemsRes,
    latestRecapsRes,
    recentActionsRes,
    recentReflectionsRes,
    recentConvosRes,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name").in("user_id", learnerIds),
    supabase
      .from("goal_sprints")
      .select("user_id")
      .in("user_id", learnerIds)
      .eq("status", "active"),
    supabase
      .from("lesson_questions")
      .select("id, user_id, question, created_at, flagged_to_coach_at, lesson_id, lessons(title)")
      .in("user_id", learnerIds)
      .not("flagged_to_coach_at", "is", null)
      .is("coach_responded_at", null)
      .is("resolved_at", null)
      .order("flagged_to_coach_at", { ascending: true }),
    supabase
      .from("action_items")
      .select("id, learner_user_id, title, due_date, completed")
      .in("learner_user_id", learnerIds)
      .eq("completed", false)
      .lt("due_date", todayIso)
      .order("due_date", { ascending: true }),
    supabase
      .from("session_recaps")
      .select("learner_user_id, session_date")
      .eq("coach_user_id", coachUserId)
      .in("learner_user_id", learnerIds)
      .order("session_date", { ascending: false }),
    supabase
      .from("action_logs")
      .select("user_id, occurred_on")
      .in("user_id", learnerIds)
      .gte("occurred_on", quietCutoffIso),
    supabase
      .from("reflections")
      .select("user_id, reflected_on")
      .in("user_id", learnerIds)
      .gte("reflected_on", quietCutoffIso),
    supabase
      .from("ai_conversations")
      .select("user_id, last_message_at")
      .in("user_id", learnerIds)
      .gte("last_message_at", quietCutoffTs),
  ]);

  const nameMap = new Map(
    (profilesRes.data ?? []).map(
      (p) => [p.user_id, p.display_name ?? "Unnamed coachee"] as const,
    ),
  );
  const sprintSet = new Set((activeSprintsRes.data ?? []).map((s) => s.user_id));

  const latestRecapByLearner = new Map<string, string>();
  for (const r of latestRecapsRes.data ?? []) {
    if (!latestRecapByLearner.has(r.learner_user_id)) {
      latestRecapByLearner.set(r.learner_user_id, r.session_date);
    }
  }

  const recentActivityByLearner = new Set<string>();
  for (const a of recentActionsRes.data ?? []) recentActivityByLearner.add(a.user_id);
  for (const r of recentReflectionsRes.data ?? []) recentActivityByLearner.add(r.user_id);
  for (const c of recentConvosRes.data ?? []) recentActivityByLearner.add(c.user_id);

  const overdueItemsByLearner = new Map<string, number>();
  for (const it of overdueItemsRes.data ?? []) {
    overdueItemsByLearner.set(
      it.learner_user_id,
      (overdueItemsByLearner.get(it.learner_user_id) ?? 0) + 1,
    );
  }

  const quietCount = learnerIds.filter((id) => !recentActivityByLearner.has(id)).length;
  const withActiveSprint = learnerIds.filter((id) => sprintSet.has(id)).length;
  const flaggedQuestionsWaiting = flaggedQsRes.data?.length ?? 0;
  const overdueActionItems = overdueItemsRes.data?.length ?? 0;

  // Overdue recap = on active sprint + (no recap OR last recap older than 14d).
  let overdueRecapCount = 0;
  const overdueRecapLearners: string[] = [];
  for (const id of learnerIds) {
    if (!sprintSet.has(id)) continue;
    const last = latestRecapByLearner.get(id);
    if (!last || last < recapCutoffIso) {
      overdueRecapCount += 1;
      overdueRecapLearners.push(id);
    }
  }

  // New assignments = active_from within the window + no recap yet.
  let newAssignmentsCount = 0;
  const newAssignmentLearners: Array<{ learnerId: string; activeFrom: string | null }> = [];
  for (const a of assignments ?? []) {
    if (!a.active_from) continue;
    if (a.active_from < newAssignmentCutoffIso) continue;
    if (latestRecapByLearner.has(a.learner_user_id)) continue;
    newAssignmentsCount += 1;
    newAssignmentLearners.push({ learnerId: a.learner_user_id, activeFrom: a.active_from });
  }

  // Build the priority queue.
  const items: PriorityItem[] = [];

  // 1) Flagged questions waiting — one row per question, newest-waiting-longest first.
  for (const q of flaggedQsRes.data ?? []) {
    const name = nameMap.get(q.user_id) ?? "Unnamed coachee";
    const flaggedAt = q.flagged_to_coach_at ? new Date(q.flagged_to_coach_at) : null;
    const daysWaiting = flaggedAt
      ? Math.max(0, Math.floor((today.getTime() - flaggedAt.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const lessonTitle = (q.lessons as unknown as { title?: string } | null)?.title ?? null;
    items.push({
      id: `flag:${q.id}`,
      kind: "flagged_question",
      learnerId: q.user_id,
      learnerName: name,
      title: `${name} flagged a question for you${lessonTitle ? ` (${lessonTitle})` : ""}`,
      detail:
        daysWaiting === 0
          ? "Waiting today"
          : daysWaiting === 1
            ? "Waiting 1 day"
            : `Waiting ${daysWaiting} days`,
      urgency: daysWaiting >= 3 ? "high" : "medium",
    });
  }

  // 2) Overdue action items — one row per learner (grouped).
  for (const [learnerId, count] of overdueItemsByLearner.entries()) {
    const name = nameMap.get(learnerId) ?? "Unnamed coachee";
    items.push({
      id: `overdue_items:${learnerId}`,
      kind: "overdue_action_items",
      learnerId,
      learnerName: name,
      title: `${name} has ${count} overdue action item${count === 1 ? "" : "s"}`,
      detail: "Items you assigned are past their due date",
      urgency: count >= 2 ? "high" : "medium",
    });
  }

  // 3) Overdue recap — active sprint + no recap in 14+ days.
  for (const learnerId of overdueRecapLearners) {
    const name = nameMap.get(learnerId) ?? "Unnamed coachee";
    const last = latestRecapByLearner.get(learnerId);
    const detail = last ? `Last recap ${daysAgoLabel(last, todayIso)}` : "No recaps yet";
    items.push({
      id: `recap:${learnerId}`,
      kind: "overdue_recap",
      learnerId,
      learnerName: name,
      title: `${name} — on an active sprint, no recent recap`,
      detail,
      urgency: "medium",
    });
  }

  // 4) Quiet coachees — one row per quiet learner.
  for (const id of learnerIds) {
    if (recentActivityByLearner.has(id)) continue;
    const name = nameMap.get(id) ?? "Unnamed coachee";
    items.push({
      id: `quiet:${id}`,
      kind: "quiet_coachee",
      learnerId: id,
      learnerName: name,
      title: `${name} has gone quiet`,
      detail: `No actions, reflections, or Thought-Partner activity in ${QUIET_DAYS}+ days`,
      urgency: "medium",
    });
  }

  // 5) New assignments — one row each.
  for (const n of newAssignmentLearners) {
    const name = nameMap.get(n.learnerId) ?? "Unnamed coachee";
    const since = n.activeFrom ? daysAgoLabel(n.activeFrom, todayIso) : "recently";
    items.push({
      id: `new:${n.learnerId}`,
      kind: "new_assignment",
      learnerId: n.learnerId,
      learnerName: name,
      title: `${name} is a new coachee`,
      detail: `Assigned ${since} · hasn't had a first session yet`,
      urgency: "low",
    });
  }

  // Sort: high before medium before low; within tier preserve insertion order
  // which already reflects priority (flagged first, then overdue items, etc.).
  const urgencyRank: Record<PriorityItem["urgency"], number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);

  return {
    activeCoachees: learnerIds.length,
    withActiveSprint,
    quietCount,
    flaggedQuestionsWaiting,
    overdueActionItems,
    overdueRecapCount,
    newAssignments: newAssignmentsCount,
    priorityItems: items,
  };
}

function daysAgoLabel(dateStr: string, todayIso: string): string {
  const days = Math.max(
    0,
    Math.floor(
      (new Date(todayIso).getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
