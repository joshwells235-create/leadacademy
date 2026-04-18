"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// --- Invite a member ---
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["learner", "coach", "org_admin"]),
  cohortId: z.string().uuid().optional(),
});

export async function inviteMember(data: { email: string; role: string; cohortId?: string }) {
  const parsed = inviteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).eq("status", "active").in("role", ["org_admin"]).limit(1).maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle();
  const orgId = mem?.org_id;
  if (!orgId && !profile?.super_admin) return { error: "not authorized" };

  // Use admin client to find the org_id if super_admin without org_admin membership.
  let effectiveOrgId = orgId;
  if (!effectiveOrgId && profile?.super_admin) {
    const { data: firstMem } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    effectiveOrgId = firstMem?.org_id;
  }
  if (!effectiveOrgId) return { error: "no org found" };

  // Create invitation (uses service role to bypass RLS for the insert).
  const admin = createAdminClient();
  const { data: inv, error } = await admin.from("invitations").insert({
    org_id: effectiveOrgId,
    email: parsed.data.email.toLowerCase().trim(),
    role: parsed.data.role,
    cohort_id: parsed.data.cohortId ?? null,
    invited_by: user.id,
  }).select("id, token").single();

  if (error) return { error: error.message };

  // Log the activity.
  await admin.from("activity_logs").insert({
    org_id: effectiveOrgId,
    user_id: user.id,
    action: "invitation.created",
    target_type: "invitation",
    target_id: inv.id,
    details: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/admin/people");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return { ok: true, inviteUrl: `${appUrl}/register?token=${encodeURIComponent(inv.token)}` };
}

// --- Change role ---
export async function changeRole(membershipId: string, newRole: string) {
  if (!["learner", "coach", "org_admin"].includes(newRole)) return { error: "invalid role" };
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role: newRole }).eq("id", membershipId);
  if (error) return { error: error.message };
  revalidatePath("/admin/people");
  return { ok: true };
}

// --- Archive member ---
export async function archiveMember(membershipId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ status: "archived" }).eq("id", membershipId);
  if (error) return { error: error.message };
  revalidatePath("/admin/people");
  return { ok: true };
}

// --- Assign coach ---
export async function assignCoach(learnerId: string, coachId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!mem) return { error: "no membership" };

  const admin = createAdminClient();
  const { error } = await admin.from("coach_assignments").upsert({
    org_id: mem.org_id,
    coach_user_id: coachId,
    learner_user_id: learnerId,
  }, { onConflict: "coach_user_id,learner_user_id" } as never);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: mem.org_id,
    user_id: user.id,
    action: "coach_assignment.created",
    target_type: "coach_assignment",
    details: { coach_user_id: coachId, learner_user_id: learnerId },
  });

  revalidatePath("/admin/people");
  return { ok: true };
}

// --- Cohort CRUD ---
export async function createCohort(name: string, description?: string, startsAt?: string, endsAt?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!mem) return { error: "no membership" };

  const admin = createAdminClient();
  const { data, error } = await admin.from("cohorts").insert({
    org_id: mem.org_id,
    name,
    description: description ?? null,
    starts_at: startsAt ?? null,
    ends_at: endsAt ?? null,
  }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/cohorts");
  return { ok: true, id: data.id };
}

export async function updateCohort(id: string, updates: { name?: string; description?: string; starts_at?: string; ends_at?: string }) {
  const admin = createAdminClient();
  const { error } = await admin.from("cohorts").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/cohorts");
  return { ok: true };
}
