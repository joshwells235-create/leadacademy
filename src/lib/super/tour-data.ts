"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TourSampleData = {
  orgId: string | null;
  orgName: string | null;
  memberUserId: string | null;
  memberOrgId: string | null;
};

/**
 * Pulls real IDs so the spotlight tour can drive into actual org-detail
 * and learner-detail pages instead of dead-ending on placeholder routes.
 * Super-admin only; returns nulls (not an error) when the platform has no
 * orgs/members yet so the tour gracefully drops those steps.
 */
export async function getTourSampleData(): Promise<TourSampleData> {
  const empty: TourSampleData = {
    orgId: null,
    orgName: null,
    memberUserId: null,
    memberOrgId: null,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return empty;

  const admin = createAdminClient();

  // Newest active org — the one a new admin is most likely to have just
  // created, so the tour lands somewhere familiar.
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orgId = org?.id ?? null;
  const orgName = org?.name ?? null;

  let memberUserId: string | null = null;
  let memberOrgId: string | null = null;
  if (orgId) {
    // Prefer a learner (the learner-detail page is richest for them), but
    // fall back to any active member so the step isn't dropped on an
    // org that only has staff.
    const { data: learner } = await admin
      .from("memberships")
      .select("user_id, org_id")
      .eq("org_id", orgId)
      .eq("status", "active")
      .eq("role", "learner")
      .limit(1)
      .maybeSingle();
    const pick =
      learner ??
      (
        await admin
          .from("memberships")
          .select("user_id, org_id")
          .eq("org_id", orgId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle()
      ).data;
    if (pick) {
      memberUserId = pick.user_id;
      memberOrgId = pick.org_id;
    }
  }

  return { orgId, orgName, memberUserId, memberOrgId };
}
