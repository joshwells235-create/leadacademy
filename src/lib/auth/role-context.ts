import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RoleContext = {
  superAdmin: boolean;
  memberships: Array<{ role: string; org_id: string; cohort_id: string | null }>;
  isCoach: boolean;
  isOrgAdmin: boolean;
  isLearner: boolean;
  isConsultant: boolean;
  /**
   * True when the user is exclusively a coach — has a coach membership but
   * is not a learner anywhere, is not a super_admin, is not an org_admin
   * or consultant. Coach-primary users get a coach-shaped top nav and
   * land on /coach/dashboard by default instead of /dashboard.
   *
   * Per product: no coaches are also learners. The only exception is the
   * super-admin, who is excluded here because the super portal handles them.
   */
  coachPrimary: boolean;
};

export async function getUserRoleContext(
  // biome-ignore lint/suspicious/noExplicitAny: SupabaseClient generic mismatch across callers
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<RoleContext> {
  const [{ data: profile }, { data: memberships }, { count: consultantCohortCount }, { count: consultantOverrideCount }] =
    await Promise.all([
      supabase.from("profiles").select("super_admin").eq("user_id", userId).maybeSingle(),
      supabase
        .from("memberships")
        .select("role, org_id, cohort_id")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("cohorts")
        .select("id", { count: "exact", head: true })
        .eq("consultant_user_id", userId),
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("consultant_user_id", userId)
        .eq("status", "active"),
    ]);

  const rows = (memberships ?? []) as Array<{ role: string; org_id: string; cohort_id: string | null }>;
  const superAdmin = !!profile?.super_admin;
  const isCoach = rows.some((m) => m.role === "coach");
  const isOrgAdmin = rows.some((m) => m.role === "org_admin");
  const isLearner = rows.some((m) => m.role === "learner");
  const isConsultant = (consultantCohortCount ?? 0) > 0 || (consultantOverrideCount ?? 0) > 0;

  const coachPrimary = isCoach && !isLearner && !isOrgAdmin && !isConsultant && !superAdmin;

  return {
    superAdmin,
    memberships: rows,
    isCoach,
    isOrgAdmin,
    isLearner,
    isConsultant,
    coachPrimary,
  };
}
