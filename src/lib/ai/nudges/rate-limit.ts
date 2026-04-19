import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { GLOBAL_WEEKLY_CAP, type NudgePattern, PATTERN_COOLDOWN_DAYS } from "./types";

/**
 * Returns true if the learner has already received the weekly cap of
 * nudges (dismissed or not — dismissal doesn't grant a free refill).
 */
export async function isGlobalCapReached(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { count } = await supabase
    .from("coach_nudges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo.toISOString());
  return (count ?? 0) >= GLOBAL_WEEKLY_CAP;
}

/**
 * Returns true if the given pattern+target was recently fired and is still
 * inside its cooldown window.
 */
export async function isOnCooldown(
  supabase: SupabaseClient<Database>,
  userId: string,
  pattern: NudgePattern,
  targetId: string | null,
): Promise<boolean> {
  const cooldownDays = PATTERN_COOLDOWN_DAYS[pattern];
  const since = new Date();
  since.setDate(since.getDate() - cooldownDays);

  let query = supabase
    .from("coach_nudges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("pattern", pattern)
    .gte("created_at", since.toISOString());

  query = targetId === null ? query.is("target_id", null) : query.eq("target_id", targetId);

  const { count } = await query;
  return (count ?? 0) > 0;
}
