import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type SinceLastSessionStats = {
  /** ISO date (YYYY-MM-DD) used as the anchor — most recent recap, or a fallback N days ago. */
  anchorDate: string;
  /** True if the anchor came from a real session recap (vs the fallback window). */
  anchorFromRecap: boolean;
  /** Days between anchor and today. */
  daysSinceAnchor: number;
  /** Counts of new learner artifacts since the anchor. */
  newActions: number;
  newReflections: number;
  newPreSessionNotes: number;
  /** AI conversations with any activity since the anchor (user or assistant message). */
  newConversationActivity: number;
  /** Unacted, undismissed coach nudges fired since the anchor. */
  newNudges: number;
  /** Action items the learner has marked complete since the anchor. */
  newCompletedActionItems: number;
  /**
   * D4 — lesson-question flags the learner raised since the anchor that
   * the coach hasn't responded to yet. Actionable triage signal.
   */
  flaggedQuestionsWaiting: number;
};

const FALLBACK_DAYS = 14;

/**
 * Compute "since your last session" stats for a coach viewing a learner.
 *
 * Anchored on the coach's most recent session_recap.session_date for this
 * learner. If no recap exists, falls back to 14 days ago — so a brand-new
 * assignment still surfaces a meaningful "what's happening" signal.
 *
 * Used on the coach dashboard (per-card chips) and the learner detail page
 * (top strip). All queries are RLS-scoped so the coach only sees data they
 * already have read access to.
 */
export async function getSinceLastSessionStats(
  supabase: SupabaseClient<Database>,
  coachUserId: string,
  learnerUserId: string,
): Promise<SinceLastSessionStats> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Anchor = most recent recap written by this coach for this learner, else
  // fallback N days ago.
  const { data: latestRecap } = await supabase
    .from("session_recaps")
    .select("session_date")
    .eq("coach_user_id", coachUserId)
    .eq("learner_user_id", learnerUserId)
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallback = new Date(today);
  fallback.setDate(today.getDate() - FALLBACK_DAYS);
  const anchorDate = latestRecap?.session_date ?? fallback.toISOString().slice(0, 10);
  const anchorFromRecap = !!latestRecap;
  const anchorTs = `${anchorDate}T00:00:00Z`;

  const daysSinceAnchor = Math.max(
    0,
    Math.floor(
      (new Date(todayIso).getTime() - new Date(anchorDate).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const [
    actionsRes,
    reflectionsRes,
    preSessionRes,
    convosRes,
    nudgesRes,
    completedItemsRes,
    flaggedQuestionsRes,
  ] = await Promise.all([
    supabase
      .from("action_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", learnerUserId)
      .gt("occurred_on", anchorDate),
    supabase
      .from("reflections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", learnerUserId)
      .gt("reflected_on", anchorDate),
    supabase
      .from("pre_session_notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", learnerUserId)
      .gte("created_at", anchorTs),
    supabase
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", learnerUserId)
      .gte("last_message_at", anchorTs),
    supabase
      .from("coach_nudges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", learnerUserId)
      .gte("created_at", anchorTs),
    supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("learner_user_id", learnerUserId)
      .eq("completed", true)
      .gte("completed_at", anchorTs),
    supabase
      .from("lesson_questions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", learnerUserId)
      .not("flagged_to_coach_at", "is", null)
      .is("coach_responded_at", null)
      .is("resolved_at", null),
  ]);

  return {
    anchorDate,
    anchorFromRecap,
    daysSinceAnchor,
    newActions: actionsRes.count ?? 0,
    newReflections: reflectionsRes.count ?? 0,
    newPreSessionNotes: preSessionRes.count ?? 0,
    newConversationActivity: convosRes.count ?? 0,
    newNudges: nudgesRes.count ?? 0,
    newCompletedActionItems: completedItemsRes.count ?? 0,
    flaggedQuestionsWaiting: flaggedQuestionsRes.count ?? 0,
  };
}

export function formatSinceLastSessionLabel(stats: SinceLastSessionStats): string {
  if (stats.anchorFromRecap) {
    return stats.daysSinceAnchor === 0
      ? "Since today's recap"
      : stats.daysSinceAnchor === 1
        ? "Since your last recap (yesterday)"
        : `Since your last recap (${stats.daysSinceAnchor} days ago)`;
  }
  return `In the last ${stats.daysSinceAnchor} days`;
}

export function hasAnyNewActivity(stats: SinceLastSessionStats): boolean {
  return (
    stats.newActions > 0 ||
    stats.newReflections > 0 ||
    stats.newPreSessionNotes > 0 ||
    stats.newConversationActivity > 0 ||
    stats.newNudges > 0 ||
    stats.newCompletedActionItems > 0
  );
}
