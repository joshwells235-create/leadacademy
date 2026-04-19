import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type CapstoneGate =
  | { state: "no_membership" }
  | { state: "no_cohort" }
  | { state: "not_scheduled"; cohortName: string }
  | { state: "locked"; cohortName: string; unlocksAt: string }
  | { state: "unlocked"; cohortName: string; unlocksAt: string; orgId: string; cohortId: string };

/**
 * Determines whether the learner can access the capstone builder, based on
 * their cohort's `capstone_unlocks_at` date. Super-admin sets that date
 * manually; before it's set, learners see a "not scheduled yet" state.
 *
 * Called from both the /capstone route (to pick which UI to render) and
 * the top nav (to decide whether to surface the link at all).
 */
export async function getCapstoneGate(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CapstoneGate> {
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, cohort_id, cohorts(id, name, capstone_unlocks_at)")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) return { state: "no_membership" };
  if (!membership.cohort_id || !membership.cohorts) return { state: "no_cohort" };

  const cohort = membership.cohorts;
  if (!cohort.capstone_unlocks_at) {
    return { state: "not_scheduled", cohortName: cohort.name };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  if (cohort.capstone_unlocks_at > todayIso) {
    return {
      state: "locked",
      cohortName: cohort.name,
      unlocksAt: cohort.capstone_unlocks_at,
    };
  }

  return {
    state: "unlocked",
    cohortName: cohort.name,
    unlocksAt: cohort.capstone_unlocks_at,
    orgId: membership.org_id,
    cohortId: cohort.id,
  };
}
