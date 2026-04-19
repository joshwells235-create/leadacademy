"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Super-admin action: set (or clear) the consultant on a cohort. Scoped to
 * super_admin because the consultant-cohort relationship is a LeadShift-side
 * program decision, not something org_admins manage.
 */
export async function setCohortConsultant(cohortId: string, userId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "super admin only" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("cohorts")
    .update({ consultant_user_id: userId })
    .eq("id", cohortId);
  if (error) return { error: error.message };

  revalidatePath("/super/orgs");
  return { ok: true };
}

/**
 * Super-admin action: set (or clear) a per-learner consultant override.
 * Clearing falls back to the cohort's default consultant. Needed for cases
 * like the open academy where one cohort spans multiple consultants.
 */
export async function setLearnerConsultantOverride(
  learnerUserId: string,
  consultantUserId: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "super admin only" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ consultant_user_id: consultantUserId })
    .eq("user_id", learnerUserId)
    .eq("status", "active");
  if (error) return { error: error.message };

  revalidatePath("/super/orgs");
  return { ok: true };
}

/**
 * Consultant-facing: assign (or change) the coach for a specific learner in a
 * cohort the current user consults on. Uses `coach_assignments` so we don't
 * collide with the existing per-learner assignment model.
 */
export async function setLearnerCoach(learnerId: string, coachUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  // Verify consultant gate via RPC helper — RLS will also enforce, but an
  // explicit check produces a cleaner error if a non-consultant calls this.
  const { data: isConsultant } = await supabase.rpc("is_consultant_of_learner", {
    p_learner: learnerId,
  });
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isConsultant && !profile?.super_admin) return { error: "not authorized" };

  // Need org_id for the insert; fetch from learner's active membership.
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, cohort_id")
    .eq("user_id", learnerId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "learner has no active membership" };

  const today = new Date().toISOString().slice(0, 10);

  // Close any active assignment first — coach_assignments model is
  // historical with active_to nullable.
  await supabase
    .from("coach_assignments")
    .update({ active_to: today })
    .eq("learner_user_id", learnerId)
    .is("active_to", null);

  const { error } = await supabase.from("coach_assignments").insert({
    org_id: membership.org_id,
    coach_user_id: coachUserId,
    learner_user_id: learnerId,
    cohort_id: membership.cohort_id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/consultant");
  return { ok: true };
}

/**
 * Consultant-facing: clear the active coach assignment for a learner —
 * used when a consultant wants to unassign without immediately picking
 * a replacement. Gated to consultants of the learner (or super-admin).
 */
export async function clearLearnerCoach(learnerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const [{ data: isConsultant }, { data: profile }] = await Promise.all([
    supabase.rpc("is_consultant_of_learner", { p_learner: learnerId }),
    supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!isConsultant && !profile?.super_admin) return { error: "not authorized" };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("coach_assignments")
    .update({ active_to: today })
    .eq("learner_user_id", learnerId)
    .is("active_to", null);
  if (error) return { error: error.message };

  revalidatePath("/consultant");
  return { ok: true };
}

/**
 * Consultant-facing: edit cohort metadata the consultant cares about
 * without giving them the full super-admin cohort surface. Limited to
 * description + capstone unlock date — name/dates/org stay org-admin-
 * managed to avoid confusion across role boundaries.
 */
export async function updateCohortMetadata(
  cohortId: string,
  input: { description: string | null; capstoneUnlocksAt: string | null },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const [{ data: isConsultant }, { data: profile }] = await Promise.all([
    supabase.rpc("is_consultant_of_cohort", { p_cohort_id: cohortId }),
    supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!isConsultant && !profile?.super_admin) return { error: "not authorized" };

  // Normalize empty strings to null so the DB doesn't store whitespace-only
  // values or empty date strings (which would also fail the date check).
  const description = input.description?.trim() || null;
  const capstoneUnlocksAt = input.capstoneUnlocksAt?.trim() || null;

  const { error } = await supabase
    .from("cohorts")
    .update({ description, capstone_unlocks_at: capstoneUnlocksAt })
    .eq("id", cohortId);
  if (error) return { error: error.message };

  revalidatePath(`/consultant/cohorts/${cohortId}`);
  return { ok: true };
}
