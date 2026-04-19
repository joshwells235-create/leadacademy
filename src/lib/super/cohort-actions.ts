"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

async function logActivity(opts: {
  actorId: string;
  orgId: string;
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

const cohortSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
});

export async function superCreateCohort(
  orgId: string,
  input: z.infer<typeof cohortSchema>,
): Promise<{ ok: true; id: string } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = cohortSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  if (parsed.data.starts_at && parsed.data.ends_at && parsed.data.ends_at < parsed.data.starts_at)
    return { error: "End date can't be before start date." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cohorts")
    .insert({
      org_id: orgId,
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId,
    action: "super.cohort.created",
    targetType: "cohort",
    targetId: data.id,
    details: { name: parsed.data.name },
  });

  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true, id: data.id };
}

export async function superUpdateCohort(
  cohortId: string,
  input: z.infer<typeof cohortSchema>,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = cohortSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("cohorts")
    .select("id, org_id, starts_at, ends_at")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) return { error: "Cohort not found." };

  const newStart = parsed.data.starts_at !== undefined ? parsed.data.starts_at : cohort.starts_at;
  const newEnd = parsed.data.ends_at !== undefined ? parsed.data.ends_at : cohort.ends_at;
  if (newStart && newEnd && newEnd < newStart)
    return { error: "End date can't be before start date." };

  const { error } = await admin
    .from("cohorts")
    .update({
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
    })
    .eq("id", cohortId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: cohort.org_id,
    action: "super.cohort.updated",
    targetType: "cohort",
    targetId: cohortId,
    details: { name: parsed.data.name },
  });

  revalidatePath(`/super/orgs/${cohort.org_id}`);
  revalidatePath(`/super/orgs/${cohort.org_id}/cohorts/${cohortId}`);
  return { ok: true };
}

export async function superArchiveCohort(
  cohortId: string,
): Promise<{ ok: true } | { error: string; memberCount?: number }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("cohorts")
    .select("id, org_id, name")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) return { error: "Cohort not found." };

  const { count } = await admin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("status", "active");
  if ((count ?? 0) > 0) {
    return {
      error: `Reassign the ${count} active member${count === 1 ? "" : "s"} in this cohort before archiving.`,
      memberCount: count ?? 0,
    };
  }

  const { error } = await admin.from("cohorts").delete().eq("id", cohortId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: cohort.org_id,
    action: "super.cohort.archived",
    targetType: "cohort",
    targetId: cohortId,
    details: { name: cohort.name },
  });

  revalidatePath(`/super/orgs/${cohort.org_id}`);
  return { ok: true };
}
