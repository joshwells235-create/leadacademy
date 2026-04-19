"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MEMBER_ROLES } from "@/lib/admin/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ----------------------------------------------------------------------
// Auth + org resolution helpers
// ----------------------------------------------------------------------

type AuthCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  orgId: string;
  superAdmin: boolean;
};

async function requireAdmin(): Promise<AuthCtx | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const [{ data: profile }, { data: mem }] = await Promise.all([
    supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["org_admin"])
      .limit(1)
      .maybeSingle(),
  ]);

  const superAdmin = profile?.super_admin ?? false;
  if (!mem && !superAdmin) return { error: "Not authorized." };

  // Super-admin without org_admin membership: use their first active membership's org.
  let orgId = mem?.org_id ?? null;
  if (!orgId && superAdmin) {
    const { data: anyMem } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    orgId = anyMem?.org_id ?? null;
  }
  if (!orgId) return { error: "No org found for this admin." };

  return { supabase, userId: user.id, orgId, superAdmin };
}

// ----------------------------------------------------------------------
// Invite
// ----------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(MEMBER_ROLES),
  cohortId: z.string().uuid().optional().nullable(),
});

type InviteResult = { ok: true; inviteUrl: string } | { error: string };

/**
 * Invite one learner/coach/org_admin/consultant to this org. Prevents
 * duplicate pending invitations and active memberships so the admin
 * doesn't accidentally create two competing invite tokens for the same
 * email.
 */
export async function inviteMember(data: {
  email: string;
  role: string;
  cohortId?: string | null;
}): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const admin = createAdminClient();

  // Dedupe: pending (unconsumed, unexpired) invite for same email in same org?
  const { data: existingInvite } = await admin
    .from("invitations")
    .select("id")
    .eq("org_id", ctx.orgId)
    .ilike("email", normalizedEmail)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existingInvite) {
    return {
      error:
        "This email already has a pending invitation. Resend the existing invite instead of creating a new one.",
    };
  }

  // Dedupe: already-active member with this email in this org? Use the
  // Supabase admin auth API to resolve the email → user_id, then check
  // memberships. (Attempting a cross-schema join in PostgREST is ugly.)
  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const matchUser = authUsers?.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
  if (matchUser) {
    const { data: activeMem } = await admin
      .from("memberships")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("user_id", matchUser.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (activeMem) {
      return {
        error:
          "This email is already an active member of this org. Change their role or archive them first.",
      };
    }
  }

  const { data: inv, error } = await admin
    .from("invitations")
    .insert({
      org_id: ctx.orgId,
      email: normalizedEmail,
      role: parsed.data.role,
      cohort_id: parsed.data.cohortId ?? null,
      invited_by: ctx.userId,
    })
    .select("id, token")
    .single();
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "invitation.created",
    target_type: "invitation",
    target_id: inv.id,
    details: { email: normalizedEmail, role: parsed.data.role },
  });

  revalidatePath("/admin/people");
  return { ok: true, inviteUrl: buildInviteUrl(inv.token) };
}

/** Bulk invite — each row is independently validated; returns per-row results. */
export async function bulkInvite(
  rows: { email: string; role: string; cohortId?: string | null }[],
): Promise<{
  results: Array<
    { email: string; ok: true; inviteUrl: string } | { email: string; ok: false; error: string }
  >;
}> {
  const results: Array<
    { email: string; ok: true; inviteUrl: string } | { email: string; ok: false; error: string }
  > = [];
  // Sequential so we pick up dedup errors cleanly (bulk invites with same
  // email in the batch → second one errors, which is what we want).
  for (const row of rows) {
    const res = await inviteMember(row);
    if ("error" in res) {
      results.push({ email: row.email, ok: false, error: res.error });
    } else {
      results.push({ email: row.email, ok: true, inviteUrl: res.inviteUrl });
    }
  }
  return { results };
}

/**
 * Resend an existing invitation: rotate the token, extend expiration,
 * and return a fresh URL. The old token is immediately invalid — which
 * is the safer default when the original email was lost or the address
 * needs a new link.
 */
export async function resendInvitation(
  invitationId: string,
): Promise<{ ok: true; inviteUrl: string } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, org_id, email, consumed_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { error: "Invitation not found." };
  if (inv.org_id !== ctx.orgId && !ctx.superAdmin) return { error: "Not authorized." };
  if (inv.consumed_at) return { error: "This invitation has already been accepted." };

  // Rotate token and push expiration forward. New expires_at: 14 days from now.
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 14);
  const { data: updated, error } = await admin
    .from("invitations")
    .update({
      token: crypto.randomUUID().replace(/-/g, ""),
      expires_at: newExpiry.toISOString(),
    })
    .eq("id", invitationId)
    .select("token")
    .single();
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "invitation.resent",
    target_type: "invitation",
    target_id: invitationId,
    details: { email: inv.email },
  });

  revalidatePath("/admin/people");
  return { ok: true, inviteUrl: buildInviteUrl(updated.token) };
}

/**
 * Revoke an unconsumed invitation by expiring it now. Preserves the row
 * so activity log / audit context survives.
 */
export async function revokeInvitation(
  invitationId: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, org_id, email, consumed_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { error: "Invitation not found." };
  if (inv.org_id !== ctx.orgId && !ctx.superAdmin) return { error: "Not authorized." };
  if (inv.consumed_at) return { error: "Can't revoke — invitation already accepted." };

  const { error } = await admin
    .from("invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "invitation.revoked",
    target_type: "invitation",
    target_id: invitationId,
    details: { email: inv.email },
  });

  revalidatePath("/admin/people");
  return { ok: true };
}

function buildInviteUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${appUrl}/register?token=${encodeURIComponent(token)}`;
}

// ----------------------------------------------------------------------
// Manual add user — bypass email flow entirely (power-user / demo / SMTP
// rate-limit escape hatch). Creates a confirmed auth user directly, stamps
// a membership, returns the temp password to the admin to share.
// ----------------------------------------------------------------------

const manualAddSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.enum(MEMBER_ROLES),
  cohortId: z.string().uuid().optional().nullable(),
});

export async function manuallyAddMember(input: {
  email: string;
  displayName: string;
  role: string;
  cohortId?: string | null;
}): Promise<{ ok: true; email: string; tempPassword: string } | { error: string }> {
  const parsed = manualAddSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const email = parsed.data.email.toLowerCase().trim();
  const admin = createAdminClient();

  // Make sure this email isn't already an auth user anywhere.
  const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const match = existingUsers?.users.find((u) => u.email?.toLowerCase() === email);
  if (match) {
    return {
      error:
        "An account with this email already exists. Invite them normally or assign them a role in this org via People.",
    };
  }

  // Generate a readable temp password the admin can share.
  const tempPassword = generateTempPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.displayName },
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Couldn't create user." };
  }

  // Ensure profile row (handle_new_user trigger should create it, but if it
  // didn't, backfill so the membership insert doesn't orphan).
  await admin.from("profiles").upsert(
    { user_id: created.user.id, display_name: parsed.data.displayName },
    {
      onConflict: "user_id",
    },
  );

  const { error: memErr } = await admin.from("memberships").insert({
    org_id: ctx.orgId,
    user_id: created.user.id,
    role: parsed.data.role,
    cohort_id: parsed.data.cohortId ?? null,
    status: "active",
  });
  if (memErr) {
    // Roll back — don't leave an auth user with no membership
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Couldn't create membership: ${memErr.message}` };
  }

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "membership.manually_added",
    target_type: "membership",
    details: { email, role: parsed.data.role, cohort_id: parsed.data.cohortId ?? null },
  });

  revalidatePath("/admin/people");
  return { ok: true, email, tempPassword };
}

function generateTempPassword(): string {
  // 16 readable chars (no ambiguous l/I/0/O), meets the 12-char minimum.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 16; i++) out += chars[bytes[i] % chars.length];
  return `${out}!`;
}

// ----------------------------------------------------------------------
// Member lifecycle: role change, archive, unarchive, reassign cohort
// ----------------------------------------------------------------------

export async function changeRole(
  membershipId: string,
  newRole: string,
): Promise<{ ok: true } | { error: string }> {
  if (!(MEMBER_ROLES as readonly string[]).includes(newRole)) return { error: "Invalid role." };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { supabase, orgId, userId, superAdmin } = ctx;
  const { data: mem } = await supabase
    .from("memberships")
    .select("id, org_id, role, user_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { error: "Membership not found." };
  if (mem.org_id !== orgId && !superAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("memberships")
    .update({ role: newRole })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    org_id: mem.org_id,
    user_id: userId,
    action: "membership.role_changed",
    target_type: "membership",
    target_id: membershipId,
    details: { from: mem.role, to: newRole, learner_user_id: mem.user_id },
  });

  revalidatePath("/admin/people");
  return { ok: true };
}

export async function archiveMember(
  membershipId: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { supabase, orgId, userId, superAdmin } = ctx;
  const { data: mem } = await supabase
    .from("memberships")
    .select("id, org_id, user_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { error: "Membership not found." };
  if (mem.org_id !== orgId && !superAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("memberships")
    .update({ status: "archived" })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    org_id: mem.org_id,
    user_id: userId,
    action: "membership.archived",
    target_type: "membership",
    target_id: membershipId,
    details: { learner_user_id: mem.user_id },
  });

  revalidatePath("/admin/people");
  return { ok: true };
}

export async function unarchiveMember(
  membershipId: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { supabase, orgId, userId, superAdmin } = ctx;
  const { data: mem } = await supabase
    .from("memberships")
    .select("id, org_id, user_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { error: "Membership not found." };
  if (mem.org_id !== orgId && !superAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("memberships")
    .update({ status: "active" })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    org_id: mem.org_id,
    user_id: userId,
    action: "membership.unarchived",
    target_type: "membership",
    target_id: membershipId,
    details: { learner_user_id: mem.user_id },
  });

  revalidatePath("/admin/people");
  return { ok: true };
}

export async function reassignCohort(
  membershipId: string,
  cohortId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { supabase, orgId, userId, superAdmin } = ctx;
  const { data: mem } = await supabase
    .from("memberships")
    .select("id, org_id, user_id, cohort_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { error: "Membership not found." };
  if (mem.org_id !== orgId && !superAdmin) return { error: "Not authorized." };

  if (cohortId) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("id, org_id")
      .eq("id", cohortId)
      .maybeSingle();
    if (!cohort || cohort.org_id !== mem.org_id)
      return { error: "That cohort doesn't belong to this org." };
  }

  const { error } = await supabase
    .from("memberships")
    .update({ cohort_id: cohortId })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    org_id: mem.org_id,
    user_id: userId,
    action: "membership.cohort_reassigned",
    target_type: "membership",
    target_id: membershipId,
    details: { from: mem.cohort_id, to: cohortId, learner_user_id: mem.user_id },
  });

  revalidatePath("/admin/people");
  revalidatePath("/admin/cohorts");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Coach assignment (admin-side). Closes the existing active assignment
// for a learner before inserting a new one — mirrors the consultant-side
// setLearnerCoach we built in Phase 5.
// ----------------------------------------------------------------------

export async function assignCoach(
  learnerId: string,
  coachId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: learnerMem } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", learnerId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!learnerMem) return { error: "Learner has no active membership." };
  if (learnerMem.org_id !== ctx.orgId && !ctx.superAdmin) return { error: "Not authorized." };

  const today = new Date().toISOString().slice(0, 10);
  // Close any active assignment first
  await admin
    .from("coach_assignments")
    .update({ active_to: today })
    .eq("learner_user_id", learnerId)
    .is("active_to", null);

  if (coachId) {
    const { error } = await admin.from("coach_assignments").insert({
      org_id: learnerMem.org_id,
      coach_user_id: coachId,
      learner_user_id: learnerId,
    });
    if (error) return { error: error.message };

    await admin.from("activity_logs").insert({
      org_id: learnerMem.org_id,
      user_id: ctx.userId,
      action: "coach_assignment.created",
      target_type: "coach_assignment",
      details: { coach_user_id: coachId, learner_user_id: learnerId },
    });
  } else {
    await admin.from("activity_logs").insert({
      org_id: learnerMem.org_id,
      user_id: ctx.userId,
      action: "coach_assignment.cleared",
      target_type: "coach_assignment",
      details: { learner_user_id: learnerId },
    });
  }

  revalidatePath("/admin/people");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Bulk operations
// ----------------------------------------------------------------------

export async function bulkArchive(
  membershipIds: string[],
): Promise<{ ok: true; count: number } | { error: string }> {
  if (membershipIds.length === 0) return { error: "Nothing selected." };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: mems } = await admin
    .from("memberships")
    .select("id, org_id")
    .in("id", membershipIds);
  const scoped = (mems ?? []).filter((m) => m.org_id === ctx.orgId || ctx.superAdmin);
  if (scoped.length === 0) return { error: "None of those memberships are in your org." };

  const { error } = await admin
    .from("memberships")
    .update({ status: "archived" })
    .in(
      "id",
      scoped.map((m) => m.id),
    );
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "membership.bulk_archived",
    target_type: "membership",
    details: { count: scoped.length },
  });

  revalidatePath("/admin/people");
  return { ok: true, count: scoped.length };
}

export async function bulkUnarchive(
  membershipIds: string[],
): Promise<{ ok: true; count: number } | { error: string }> {
  if (membershipIds.length === 0) return { error: "Nothing selected." };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: mems } = await admin
    .from("memberships")
    .select("id, org_id")
    .in("id", membershipIds);
  const scoped = (mems ?? []).filter((m) => m.org_id === ctx.orgId || ctx.superAdmin);
  if (scoped.length === 0) return { error: "None of those memberships are in your org." };

  const { error } = await admin
    .from("memberships")
    .update({ status: "active" })
    .in(
      "id",
      scoped.map((m) => m.id),
    );
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "membership.bulk_unarchived",
    target_type: "membership",
    details: { count: scoped.length },
  });

  revalidatePath("/admin/people");
  return { ok: true, count: scoped.length };
}

export async function bulkAssignCohort(
  membershipIds: string[],
  cohortId: string | null,
): Promise<{ ok: true; count: number } | { error: string }> {
  if (membershipIds.length === 0) return { error: "Nothing selected." };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();

  if (cohortId) {
    const { data: cohort } = await admin
      .from("cohorts")
      .select("id, org_id")
      .eq("id", cohortId)
      .maybeSingle();
    if (!cohort || (cohort.org_id !== ctx.orgId && !ctx.superAdmin))
      return { error: "That cohort doesn't belong to this org." };
  }

  const { data: mems } = await admin
    .from("memberships")
    .select("id, org_id")
    .in("id", membershipIds);
  const scoped = (mems ?? []).filter((m) => m.org_id === ctx.orgId || ctx.superAdmin);
  if (scoped.length === 0) return { error: "None of those memberships are in your org." };

  const { error } = await admin
    .from("memberships")
    .update({ cohort_id: cohortId })
    .in(
      "id",
      scoped.map((m) => m.id),
    );
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "membership.bulk_cohort_reassigned",
    target_type: "membership",
    details: { count: scoped.length, cohort_id: cohortId },
  });

  revalidatePath("/admin/people");
  revalidatePath("/admin/cohorts");
  return { ok: true, count: scoped.length };
}

export async function bulkAssignCoach(
  learnerIds: string[],
  coachId: string,
): Promise<{ ok: true; count: number } | { error: string }> {
  if (learnerIds.length === 0) return { error: "Nothing selected." };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  let count = 0;
  for (const learnerId of learnerIds) {
    const res = await assignCoach(learnerId, coachId);
    if ("ok" in res) count += 1;
  }
  revalidatePath("/admin/people");
  return { ok: true, count };
}

// ----------------------------------------------------------------------
// Cohort CRUD (full lifecycle)
// ----------------------------------------------------------------------

const cohortSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
});

export async function createCohort(input: {
  name: string;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = cohortSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  if (parsed.data.starts_at && parsed.data.ends_at && parsed.data.ends_at < parsed.data.starts_at)
    return { error: "End date can't be before start date." };

  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cohorts")
    .insert({
      org_id: ctx.orgId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action: "cohort.created",
    target_type: "cohort",
    target_id: data.id,
    details: { name: parsed.data.name },
  });

  revalidatePath("/admin/cohorts");
  return { ok: true, id: data.id };
}

export async function updateCohort(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("cohorts")
    .select("id, org_id, starts_at, ends_at")
    .eq("id", id)
    .maybeSingle();
  if (!cohort) return { error: "Cohort not found." };
  if (cohort.org_id !== ctx.orgId && !ctx.superAdmin) return { error: "Not authorized." };

  const newStart = updates.starts_at !== undefined ? updates.starts_at : cohort.starts_at;
  const newEnd = updates.ends_at !== undefined ? updates.ends_at : cohort.ends_at;
  if (newStart && newEnd && newEnd < newStart)
    return { error: "End date can't be before start date." };

  const { error } = await admin
    .from("cohorts")
    .update({
      name: updates.name?.trim(),
      description:
        updates.description === undefined ? undefined : updates.description?.trim() || null,
      starts_at: updates.starts_at,
      ends_at: updates.ends_at,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: cohort.org_id,
    user_id: ctx.userId,
    action: "cohort.updated",
    target_type: "cohort",
    target_id: id,
    details: {},
  });

  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${id}`);
  return { ok: true };
}

/**
 * Archive (soft delete) a cohort. Blocks if there are active memberships
 * in it — admin must reassign those first to avoid orphaning learners
 * mid-program.
 */
export async function archiveCohort(
  id: string,
): Promise<{ ok: true } | { error: string; memberCount?: number }> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("cohorts")
    .select("id, org_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!cohort) return { error: "Cohort not found." };
  if (cohort.org_id !== ctx.orgId && !ctx.superAdmin) return { error: "Not authorized." };

  const { count } = await admin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", id)
    .eq("status", "active");
  if ((count ?? 0) > 0) {
    return {
      error: `Reassign the ${count} active member${count === 1 ? "" : "s"} in this cohort before archiving.`,
      memberCount: count ?? 0,
    };
  }

  const { error } = await admin.from("cohorts").delete().eq("id", id);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: cohort.org_id,
    user_id: ctx.userId,
    action: "cohort.archived",
    target_type: "cohort",
    target_id: id,
    details: { name: cohort.name },
  });

  revalidatePath("/admin/cohorts");
  return { ok: true };
}
