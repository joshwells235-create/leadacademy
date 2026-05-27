"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { createClient } from "@/lib/supabase/server";

export type PersonHit = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role_label: string;
  org_name: string | null;
  /** Where the palette should navigate when selected. */
  href: string;
};

/**
 * Staff-only people search powering the ⌘K palette. Returns up to 10
 * matches whose display_name or email contains the query, scoped to
 * orgs the caller has access to.
 *
 * Access scope:
 *   - super_admin: any user across any org → super/users/[id]
 *   - org_admin: members of their org(s) → admin/people (deep link not
 *     available — we just route to the people index)
 *   - coach: their coachees → /coach/learners/[id]
 *   - consultant: members of cohorts they consult on →
 *     /consultant/learners/[id]
 *
 * Non-staff (learners) get an empty result — palette UI hides search
 * for them anyway.
 */
export async function searchPeople(query: string): Promise<PersonHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const role = await getUserRoleContext(supabase, user.id);
  const isStaff =
    role.superAdmin || role.isOrgAdmin || role.isCoach || role.isConsultant;
  if (!isStaff) return [];

  const admin = createAdminClient();

  // Build the org scope. Super admins skip the scope filter entirely.
  let orgIds: string[] | null = null;
  if (!role.superAdmin) {
    const orgs = new Set<string>();
    for (const m of role.memberships) {
      // Coaches + org admins see anyone in their own org. Consultants
      // see members of orgs where they consult (resolved below via
      // cohorts.consultant_user_id rather than membership role).
      if (m.role === "org_admin" || m.role === "coach") orgs.add(m.org_id);
    }
    if (role.isConsultant) {
      const { data: consultantCohorts } = await admin
        .from("cohorts")
        .select("org_id")
        .eq("consultant_user_id", user.id);
      for (const c of consultantCohorts ?? []) {
        if (c.org_id) orgs.add(c.org_id);
      }
    }
    orgIds = Array.from(orgs);
    if (orgIds.length === 0) return [];
  }

  // Match against display_name OR email. We pull a wider net (50) and
  // filter to 10 after de-duping by user_id (a user can have multiple
  // active memberships).
  const matchPattern = `%${trimmed.replace(/[%_]/g, "\\$&")}%`;

  // Step 1: profile name matches.
  const nameQuery = admin
    .from("profiles")
    .select("user_id, display_name")
    .ilike("display_name", matchPattern)
    .is("deleted_at", null)
    .limit(50);
  const { data: nameMatches } = await nameQuery;

  // Step 2: auth.users email matches — separate because PostgREST can't
  // cross schemas comfortably. List + filter locally; cap at 200 (the
  // typical org size for this product).
  const { data: authUsersRes } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const emailMatches = (authUsersRes?.users ?? [])
    .filter((u) => u.email?.toLowerCase().includes(trimmed.toLowerCase()))
    .map((u) => ({ user_id: u.id, email: u.email ?? null }));

  const candidateUserIds = Array.from(
    new Set([
      ...(nameMatches ?? []).map((n) => n.user_id),
      ...emailMatches.map((e) => e.user_id),
    ]),
  );
  if (candidateUserIds.length === 0) return [];

  // Step 3: pull active memberships for the candidates, scoped to the
  // caller's accessible orgs.
  let membershipQuery = admin
    .from("memberships")
    .select(
      "user_id, role, org_id, organizations:org_id(name), profiles:user_id(display_name)",
    )
    .in("user_id", candidateUserIds)
    .eq("status", "active");
  if (orgIds !== null) {
    membershipQuery = membershipQuery.in("org_id", orgIds);
  }
  const { data: memberships } = await membershipQuery;

  // De-dupe by user_id (first membership wins for the href + label).
  const emailByUser = new Map(emailMatches.map((e) => [e.user_id, e.email]));
  const seen = new Set<string>();
  const hits: PersonHit[] = [];
  for (const m of memberships ?? []) {
    if (seen.has(m.user_id)) continue;
    seen.add(m.user_id);
    const profileName =
      (m.profiles as unknown as { display_name: string | null } | null)
        ?.display_name ?? null;
    const orgName =
      (m.organizations as unknown as { name: string | null } | null)?.name ?? null;
    const email = emailByUser.get(m.user_id) ?? null;
    hits.push({
      user_id: m.user_id,
      display_name: profileName,
      email,
      role_label: m.role,
      org_name: orgName,
      href: hrefForPerson({
        superAdmin: role.superAdmin,
        isCoach: role.isCoach,
        isConsultant: role.isConsultant,
        targetOrgId: m.org_id,
        targetUserId: m.user_id,
      }),
    });
    if (hits.length >= 10) break;
  }
  return hits;
}

function hrefForPerson(opts: {
  superAdmin: boolean;
  isCoach: boolean;
  isConsultant: boolean;
  targetOrgId: string;
  targetUserId: string;
}): string {
  if (opts.superAdmin) {
    return `/super/orgs/${opts.targetOrgId}/members/${opts.targetUserId}`;
  }
  if (opts.isConsultant) {
    return `/consultant/learners/${opts.targetUserId}`;
  }
  if (opts.isCoach) {
    return `/coach/learners/${opts.targetUserId}`;
  }
  // org_admin fallback — no per-user detail surface yet, route to People.
  return "/admin/people";
}
