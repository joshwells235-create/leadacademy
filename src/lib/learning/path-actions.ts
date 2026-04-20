"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * LMS Phase C4 — learning paths.
 *
 * A path is a sequenced series of courses. Org-scoped (or super-authored
 * cross-org templates with org_id null). Assigning a path to a cohort
 * **auto-materializes** individual cohort_courses rows so all existing
 * readers (vitality, due dates, scheduled unlock, lesson gates) keep
 * working with no fork. The cohort_learning_paths row is the *origin*;
 * cohort_courses is the canonical set the rest of the app reads.
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
// Path CRUD
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  org_id: z.string().uuid().optional().nullable(),
});

export async function createPath(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("learning_paths")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      org_id: parsed.data.org_id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create path." };

  await logActivity({
    actorId: ctx.userId,
    orgId: parsed.data.org_id ?? null,
    action: "super.path.created",
    targetType: "learning_path",
    targetId: data.id,
    details: { name: parsed.data.name },
  });

  revalidatePath("/super/learning-paths");
  return { ok: true, id: data.id };
}

const updateSchema = z.object({
  pathId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  org_id: z.string().uuid().optional().nullable(),
  cert_validity_months: z.number().int().min(1).max(600).optional().nullable(),
});

export async function updatePath(
  input: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.org_id !== undefined) update.org_id = parsed.data.org_id;
  if (parsed.data.cert_validity_months !== undefined)
    update.cert_validity_months = parsed.data.cert_validity_months;
  if (Object.keys(update).length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("learning_paths")
    // biome-ignore lint/suspicious/noExplicitAny: runtime-shaped partial update
    .update(update as any)
    .eq("id", parsed.data.pathId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: (parsed.data.org_id as string | null) ?? null,
    action: "super.path.updated",
    targetType: "learning_path",
    targetId: parsed.data.pathId,
  });

  revalidatePath("/super/learning-paths");
  revalidatePath(`/super/learning-paths/${parsed.data.pathId}`);
  return { ok: true };
}

export async function deletePath(pathId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();

  // We don't tear down materialized cohort_courses rows on path delete —
  // those may have been edited (schedule, due_at) and represent real
  // assignments. The path going away just removes the "Your path" framing.
  const { error } = await admin.from("learning_paths").delete().eq("id", pathId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.path.deleted",
    targetType: "learning_path",
    targetId: pathId,
  });

  revalidatePath("/super/learning-paths");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Path-course composition
// ---------------------------------------------------------------------------

const setPathCoursesSchema = z.object({
  pathId: z.string().uuid(),
  /** Course ids in the desired order. */
  courseIds: z.array(z.string().uuid()).max(50),
});

export async function setPathCourses(
  input: z.infer<typeof setPathCoursesSchema>,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = setPathCoursesSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { pathId, courseIds } = parsed.data;

  // Reject duplicate course ids — the unique constraint would catch it but
  // a friendlier error is nicer.
  if (new Set(courseIds).size !== courseIds.length)
    return { error: "A course can't appear twice in a path." };

  const admin = createAdminClient();

  // Verify courses still exist.
  if (courseIds.length > 0) {
    const { data: existing } = await admin.from("courses").select("id").in("id", courseIds);
    const found = new Set((existing ?? []).map((c) => c.id));
    if (courseIds.some((id) => !found.has(id)))
      return { error: "One or more courses no longer exist." };
  }

  // Replace-all.
  const { error: delErr } = await admin
    .from("learning_path_courses")
    .delete()
    .eq("path_id", pathId);
  if (delErr) return { error: delErr.message };

  if (courseIds.length > 0) {
    const { error: insErr } = await admin.from("learning_path_courses").insert(
      courseIds.map((cid, idx) => ({
        path_id: pathId,
        course_id: cid,
        order: idx,
      })),
    );
    if (insErr) return { error: insErr.message };
  }

  await logActivity({
    actorId: ctx.userId,
    orgId: null,
    action: "super.path.courses_set",
    targetType: "learning_path",
    targetId: pathId,
    details: { count: courseIds.length },
  });

  revalidatePath(`/super/learning-paths/${pathId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cohort assignment + auto-materialization
// ---------------------------------------------------------------------------

/**
 * Materialize a path's courses as cohort_courses for the given cohort.
 * Idempotent: existing assignments are left intact (preserving any
 * per-cohort schedule / due-date edits). New ones inherit the path's
 * `available_from` and `due_at` if set.
 */
async function materializePathToCohort(
  cohortId: string,
  pathId: string,
  available_from: string | null,
  due_at: string | null,
) {
  const admin = createAdminClient();
  const { data: pathCourses } = await admin
    .from("learning_path_courses")
    .select("course_id")
    .eq("path_id", pathId)
    .order("order");

  const courseIds = (pathCourses ?? []).map((p) => p.course_id);
  if (courseIds.length === 0) return { inserted: 0 };

  const { data: existing } = await admin
    .from("cohort_courses")
    .select("course_id")
    .eq("cohort_id", cohortId)
    .in("course_id", courseIds);
  const alreadyAssigned = new Set((existing ?? []).map((e) => e.course_id));

  const toInsert = courseIds
    .filter((cid) => !alreadyAssigned.has(cid))
    .map((cid) => ({
      cohort_id: cohortId,
      course_id: cid,
      available_from,
      due_at,
    }));
  if (toInsert.length === 0) return { inserted: 0 };

  const { error } = await admin.from("cohort_courses").insert(toInsert);
  if (error) throw new Error(error.message);
  return { inserted: toInsert.length };
}

const assignPathSchema = z.object({
  pathId: z.string().uuid(),
  cohortId: z.string().uuid(),
  available_from: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
});

export async function assignPathToCohort(
  input: z.infer<typeof assignPathSchema>,
): Promise<{ ok: true; materialized: number } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = assignPathSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { pathId, cohortId } = parsed.data;
  const norm = (v: string | null | undefined) => (v === undefined || v === "" ? null : v);
  const available_from = norm(parsed.data.available_from);
  const due_at = norm(parsed.data.due_at);

  if (available_from && due_at && due_at < available_from)
    return { error: "Due date can't be before the available-from date." };

  const admin = createAdminClient();

  // Upsert the cohort_learning_paths row first so the framing exists even
  // if there are no path courses yet.
  const { error: linkErr } = await admin
    .from("cohort_learning_paths")
    .upsert(
      { cohort_id: cohortId, path_id: pathId, available_from, due_at },
      { onConflict: "cohort_id,path_id" },
    );
  if (linkErr) return { error: linkErr.message };

  let materialized = 0;
  try {
    const res = await materializePathToCohort(cohortId, pathId, available_from, due_at);
    materialized = res.inserted;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to materialize path." };
  }

  const { data: cohort } = await admin
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .maybeSingle();

  // Auto-cover: any cohort learner who's already completed every course
  // in this path gets a path certificate now (instead of waiting for
  // them to re-complete something). Runs inline but fire-and-forget per
  // learner so a single failure doesn't derail assignment.
  try {
    const { data: learners } = await admin
      .from("memberships")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .eq("status", "active");
    if (learners && learners.length > 0) {
      const { maybeIssueCertificate } = await import("@/lib/certificates/issue");
      await Promise.allSettled(
        learners.map((l) =>
          maybeIssueCertificate({
            kind: "path",
            userId: l.user_id,
            pathId,
            cohortId,
          }),
        ),
      );
    }
  } catch {
    // Auto-cover is best-effort; don't fail assignment if it errors.
  }

  await logActivity({
    actorId: ctx.userId,
    orgId: cohort?.org_id ?? null,
    action: "super.path.assigned",
    targetType: "cohort",
    targetId: cohortId,
    details: { path_id: pathId, materialized },
  });

  revalidatePath("/super/learning-paths");
  revalidatePath(`/super/learning-paths/${pathId}`);
  revalidatePath(`/super/orgs/${cohort?.org_id}/cohorts/${cohortId}`);
  return { ok: true, materialized };
}

export async function unassignPathFromCohort(
  cohortId: string,
  pathId: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  // Only remove the path framing — leave materialized cohort_courses rows
  // alone. Removing them would silently destroy schedule + due-date edits.
  const { error } = await admin
    .from("cohort_learning_paths")
    .delete()
    .eq("cohort_id", cohortId)
    .eq("path_id", pathId);
  if (error) return { error: error.message };

  const { data: cohort } = await admin
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .maybeSingle();

  await logActivity({
    actorId: ctx.userId,
    orgId: cohort?.org_id ?? null,
    action: "super.path.unassigned",
    targetType: "cohort",
    targetId: cohortId,
    details: { path_id: pathId },
  });

  revalidatePath(`/super/learning-paths/${pathId}`);
  return { ok: true };
}
