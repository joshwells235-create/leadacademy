import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { fireNudge } from "./fire";
import { DETECTORS } from "./patterns";
import { isGlobalCapReached, isOnCooldown } from "./rate-limit";
import { PATTERN_PRIORITY } from "./types";

/**
 * Run proactive nudge detection for a learner. Called inline on dashboard
 * visits. At most one nudge fires per call. Safe to call on every visit —
 * rate limits (global weekly cap + per-pattern cooldown) keep it quiet.
 *
 * Honors `profiles.proactivity_enabled = false` as a hard off switch.
 * Short-circuits to a no-op if the learner has no active membership.
 */
export async function detectAndFireNudge(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ fired: boolean; pattern?: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("proactivity_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.proactivity_enabled) {
    return { fired: false };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { fired: false };

  if (await isGlobalCapReached(supabase, userId)) {
    return { fired: false };
  }

  const now = new Date();
  for (const pattern of PATTERN_PRIORITY) {
    const detector = DETECTORS[pattern];
    let candidate: Awaited<ReturnType<typeof detector>> | null = null;
    try {
      candidate = await detector({ supabase, userId, now });
    } catch {
      continue;
    }
    if (!candidate) continue;

    if (await isOnCooldown(supabase, userId, candidate.pattern, candidate.targetId)) {
      continue;
    }

    const id = await fireNudge({
      userScoped: supabase,
      userId,
      orgId: membership.org_id,
      candidate,
    });
    if (id) return { fired: true, pattern: candidate.pattern };
  }
  return { fired: false };
}
