"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MEMBER_ROLES } from "@/lib/admin/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

const announcementSchema = z
  .object({
    scope: z.enum(["global", "org", "cohort", "role"]),
    orgId: z.string().uuid().nullable().optional(),
    cohortId: z.string().uuid().nullable().optional(),
    role: z.enum(MEMBER_ROLES).nullable().optional(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
    tone: z.enum(["info", "warning", "success"]).default("info"),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
  })
  .refine(
    (v) => {
      if (v.scope === "global") return !v.orgId && !v.cohortId && !v.role;
      if (v.scope === "org") return !!v.orgId && !v.cohortId && !v.role;
      if (v.scope === "cohort") return !!v.cohortId;
      if (v.scope === "role") return !!v.role;
      return false;
    },
    { message: "Scope does not match provided target fields." },
  );

export async function createAnnouncement(input: z.infer<typeof announcementSchema>) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid announcement." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .insert({
      scope: parsed.data.scope,
      org_id: parsed.data.orgId ?? null,
      cohort_id: parsed.data.cohortId ?? null,
      role: parsed.data.role ?? null,
      title: parsed.data.title,
      body: parsed.data.body,
      tone: parsed.data.tone,
      starts_at: parsed.data.startsAt || new Date().toISOString(),
      ends_at: parsed.data.endsAt || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: parsed.data.orgId ?? null,
    user_id: ctx.userId,
    action: "super.announcement.created",
    target_type: "announcement",
    target_id: data.id,
    details: {
      scope: parsed.data.scope,
      role: parsed.data.role ?? null,
      cohort_id: parsed.data.cohortId ?? null,
      title: parsed.data.title,
    } as never,
  });

  revalidatePath("/super/announcements");
  return { ok: true, id: data.id };
}

export async function updateAnnouncement(id: string, input: z.infer<typeof announcementSchema>) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid announcement." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .update({
      scope: parsed.data.scope,
      org_id: parsed.data.orgId ?? null,
      cohort_id: parsed.data.cohortId ?? null,
      role: parsed.data.role ?? null,
      title: parsed.data.title,
      body: parsed.data.body,
      tone: parsed.data.tone,
      starts_at: parsed.data.startsAt || undefined,
      ends_at: parsed.data.endsAt || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/super/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(id: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin.from("announcements").delete().eq("id", id);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: ctx.userId,
    action: "super.announcement.deleted",
    target_type: "announcement",
    target_id: id,
    details: {} as never,
  });

  revalidatePath("/super/announcements");
  return { ok: true };
}

/**
 * End an active announcement now (sets ends_at = now). Non-destructive
 * — history is preserved and the announcement disappears for all users
 * on next page load.
 */
export async function endAnnouncement(id: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .update({ ends_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/super/announcements");
  return { ok: true };
}

export async function dismissAnnouncement(announcementId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("announcement_dismissals")
    .upsert(
      { user_id: user.id, announcement_id: announcementId },
      { onConflict: "user_id,announcement_id" },
    );
  if (error) return { error: error.message };
  return { ok: true };
}
