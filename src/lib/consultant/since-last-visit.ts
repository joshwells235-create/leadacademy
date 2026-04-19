import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type ConsultantSinceStats = {
  anchorDate: string;
  daysSinceAnchor: number;
  newActions: number;
  newReflections: number;
  newPreSessionNotes: number;
  newConversationActivity: number;
  newNudges: number;
  newRecaps: number;
  newCompletedActionItems: number;
};

const WINDOW_DAYS = 14;

/**
 * "What's new in the last 14 days" signal for a consultant viewing a
 * learner. Consultants don't write session recaps the way coaches do, so
 * there's no per-consultant anchor to use — a rolling window is the
 * natural fit. Mirrors the coach-side stats but adds newRecaps (the
 * consultant cares when a coach has written a new recap; the coach
 * already knows what they wrote).
 */
export async function getConsultantSinceStats(
  supabase: SupabaseClient<Database>,
  learnerUserId: string,
): Promise<ConsultantSinceStats> {
  const today = new Date();
  const anchor = new Date(today);
  anchor.setDate(today.getDate() - WINDOW_DAYS);
  const anchorDate = anchor.toISOString().slice(0, 10);
  const anchorTs = anchor.toISOString();

  const [
    actionsRes,
    reflectionsRes,
    preSessionRes,
    convosRes,
    nudgesRes,
    recapsRes,
    completedItemsRes,
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
      .from("session_recaps")
      .select("id", { count: "exact", head: true })
      .eq("learner_user_id", learnerUserId)
      .gte("created_at", anchorTs),
    supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("learner_user_id", learnerUserId)
      .eq("completed", true)
      .gte("completed_at", anchorTs),
  ]);

  return {
    anchorDate,
    daysSinceAnchor: WINDOW_DAYS,
    newActions: actionsRes.count ?? 0,
    newReflections: reflectionsRes.count ?? 0,
    newPreSessionNotes: preSessionRes.count ?? 0,
    newConversationActivity: convosRes.count ?? 0,
    newNudges: nudgesRes.count ?? 0,
    newRecaps: recapsRes.count ?? 0,
    newCompletedActionItems: completedItemsRes.count ?? 0,
  };
}

export function hasAnyNewConsultantActivity(stats: ConsultantSinceStats): boolean {
  return (
    stats.newActions > 0 ||
    stats.newReflections > 0 ||
    stats.newPreSessionNotes > 0 ||
    stats.newConversationActivity > 0 ||
    stats.newNudges > 0 ||
    stats.newRecaps > 0 ||
    stats.newCompletedActionItems > 0
  );
}
