"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MEMBER_ROLES } from "@/lib/admin/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Super-admin user-lifecycle actions. Every action requires super-admin
 * authz and writes to `activity_logs` with `super.user.*` / `super.membership.*`
 * keys. auth.users mutations go through the service-role client.
 */
async function requireSuperAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "Not authorized." };
  return { userId: user.id };
}

async function logActivity(opts: {
  actorId: string;
  orgId: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("activity_logs").insert({
    org_id: opts.orgId,
    user_id: opts.actorId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    details: (opts.details ?? {}) as never,
  });
}

// ---------------------------------------------------------------------------
// Profile edits
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(120).optional().nullable(),
  role_title: z.string().trim().max(120).optional().nullable(),
  function_area: z.string().trim().max(120).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  company_size: z.string().trim().max(120).optional().nullable(),
  team_size: z.number().int().min(0).max(100000).optional().nullable(),
  total_org_influence: z.number().int().min(0).max(10_000_000).optional().nullable(),
  tenure_at_org: z.string().trim().max(120).optional().nullable(),
  tenure_in_leadership: z.string().trim().max(120).optional().nullable(),
  context_notes: z.string().trim().max(4000).optional().nullable(),
});

export async function updateUserProfile(userId: string, fields: z.infer<typeof profileSchema>) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = profileSchema.safeParse(fields);
  if (!parsed.success) return { error: "Invalid profile fields." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(parsed.data).eq("user_id", userId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.profile_updated",
    targetType: "profile",
    targetId: userId,
    details: { fields: Object.keys(parsed.data) },
  });

  revalidatePath(`/super/users/${userId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Email + password + auth state
// ---------------------------------------------------------------------------

const emailSchema = z.string().email();

export async function updateUserEmail(
  userId: string,
  newEmail: string,
  options?: { skipReverification?: boolean },
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = emailSchema.safeParse(newEmail.trim().toLowerCase());
  if (!parsed.success) return { error: "Invalid email address." };

  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  if (!existing?.user) return { error: "User not found." };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: parsed.data,
    // Only skip re-verification if explicitly requested. Default keeps
    // Supabase's built-in double-confirm flow (user gets an email to
    // confirm the new address).
    email_confirm: options?.skipReverification ?? false,
  });
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.email_changed",
    targetType: "auth.user",
    targetId: userId,
    details: {
      from: existing.user.email ?? null,
      to: parsed.data,
      skip_reverification: options?.skipReverification ?? false,
    },
  });

  revalidatePath(`/super/users/${userId}`);
  return { ok: true };
}

export async function sendPasswordReset(userId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  if (!existing?.user?.email) return { error: "User has no email on file." };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: existing.user.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
    },
  });
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.password_reset_sent",
    targetType: "auth.user",
    targetId: userId,
    details: { email: existing.user.email },
  });

  return { ok: true, link: data?.properties?.action_link ?? null };
}

export async function confirmUserEmail(userId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.email_confirmed",
    targetType: "auth.user",
    targetId: userId,
  });

  revalidatePath(`/super/users/${userId}`);
  return { ok: true };
}

export async function revokeUserSessions(userId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  // Supabase's admin signOut revokes all refresh tokens for this user.
  const { error } = await admin.auth.admin.signOut(userId, "global");
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.sessions_revoked",
    targetType: "auth.user",
    targetId: userId,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Super admin grant / revoke
// ---------------------------------------------------------------------------

export async function setSuperAdmin(userId: string, enabled: boolean) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.userId === userId && !enabled) {
    return { error: "You can't revoke your own super-admin access." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ super_admin: enabled })
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: enabled ? "super.user.super_admin_granted" : "super.user.super_admin_revoked",
    targetType: "profile",
    targetId: userId,
  });

  revalidatePath(`/super/users/${userId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Membership ops (cross-org, super-only)
// ---------------------------------------------------------------------------

const roleSchema = z.enum(MEMBER_ROLES);

export async function changeMembershipRole(membershipId: string, newRole: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = roleSchema.safeParse(newRole);
  if (!parsed.success) return { error: "Invalid role." };

  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("memberships")
    .select("user_id, org_id, role")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { error: "Membership not found." };

  const { error } = await admin
    .from("memberships")
    .update({ role: parsed.data })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: mem.org_id,
    action: "super.membership.role_changed",
    targetType: "membership",
    targetId: membershipId,
    details: { from: mem.role, to: parsed.data, learner_user_id: mem.user_id },
  });

  revalidatePath(`/super/users/${mem.user_id}`);
  return { ok: true };
}

export async function moveMembershipToOrg(
  membershipId: string,
  newOrgId: string,
  newCohortId: string | null,
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("memberships")
    .select("user_id, org_id, cohort_id, role")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { error: "Membership not found." };

  // Validate target org + cohort.
  const { data: targetOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("id", newOrgId)
    .maybeSingle();
  if (!targetOrg) return { error: "Target org not found." };
  if (newCohortId) {
    const { data: targetCohort } = await admin
      .from("cohorts")
      .select("id, org_id")
      .eq("id", newCohortId)
      .maybeSingle();
    if (!targetCohort) return { error: "Target cohort not found." };
    if (targetCohort.org_id !== newOrgId) return { error: "Cohort belongs to a different org." };
  }

  const { error } = await admin
    .from("memberships")
    .update({ org_id: newOrgId, cohort_id: newCohortId })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: newOrgId,
    action: "super.membership.moved_org",
    targetType: "membership",
    targetId: membershipId,
    details: {
      from_org_id: mem.org_id,
      to_org_id: newOrgId,
      from_cohort_id: mem.cohort_id,
      to_cohort_id: newCohortId,
      learner_user_id: mem.user_id,
    },
  });

  revalidatePath(`/super/users/${mem.user_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Soft delete / restore
// ---------------------------------------------------------------------------

export async function softDeleteUser(userId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.userId === userId) {
    return { error: "You can't soft-delete your own account." };
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Mark profile deleted.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ deleted_at: nowIso })
    .eq("user_id", userId);
  if (profileErr) return { error: profileErr.message };

  // 2. Archive all active memberships (don't delete — preserves history).
  await admin
    .from("memberships")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  // 3. Revoke all refresh tokens — they can't reach authenticated pages.
  await admin.auth.admin.signOut(userId, "global");

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.soft_deleted",
    targetType: "profile",
    targetId: userId,
  });

  revalidatePath(`/super/users/${userId}`);
  revalidatePath("/super/users");
  return { ok: true };
}

export async function restoreUser(userId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ deleted_at: null }).eq("user_id", userId);
  if (error) return { error: error.message };

  // Unarchive memberships that were active immediately before soft delete?
  // We can't reliably distinguish "archived because soft delete" from
  // "archived because admin action" — leave memberships archived so
  // the super-admin has to explicitly re-add the user to orgs.

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.user.restored",
    targetType: "profile",
    targetId: userId,
  });

  revalidatePath(`/super/users/${userId}`);
  revalidatePath("/super/users");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invitations (cross-org view)
// ---------------------------------------------------------------------------

export async function revokeInvitation(invitationId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("email, org_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { error: "Invitation not found." };

  const { error } = await admin
    .from("invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: inv.org_id,
    action: "super.invitation.revoked",
    targetType: "invitation",
    targetId: invitationId,
    details: { email: inv.email },
  });

  revalidatePath("/super/invitations");
  return { ok: true };
}
