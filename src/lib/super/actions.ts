"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Super-admin auth + activity-log helpers. Every mutating super action
 * goes through `requireSuperAdmin` for authz and `logSuperActivity` for
 * the cross-org audit trail. Super actions use a nullable `org_id` on
 * `activity_logs` so cross-org ops (create org, moderation, etc.) still
 * land in the log.
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

async function logSuperActivity(opts: {
  userId: string;
  orgId: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("activity_logs").insert({
    org_id: opts.orgId,
    user_id: opts.userId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    details: (opts.details ?? {}) as never,
  });
}

export async function createOrg(name: string, slug: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logSuperActivity({
    userId: ctx.userId,
    orgId: data.id,
    action: "super.org.created",
    targetType: "organization",
    targetId: data.id,
    details: { name, slug },
  });

  revalidatePath("/super/orgs");
  return { ok: true, id: data.id };
}

export async function updateOrg(
  id: string,
  updates: { name?: string; slug?: string; logo_url?: string; status?: string },
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update(updates).eq("id", id);
  if (error) return { error: error.message };

  await logSuperActivity({
    userId: ctx.userId,
    orgId: id,
    action: "super.org.updated",
    targetType: "organization",
    targetId: id,
    details: updates,
  });

  revalidatePath(`/super/orgs/${id}`);
  revalidatePath("/super/orgs");
  return { ok: true };
}

export async function assignCourseToCoho(cohortId: string, courseId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("cohort_courses")
    .upsert({ cohort_id: cohortId, course_id: courseId }, { onConflict: "cohort_id,course_id" });
  if (error) return { error: error.message };

  const { data: cohort } = await admin
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .maybeSingle();

  await logSuperActivity({
    userId: ctx.userId,
    orgId: cohort?.org_id ?? null,
    action: "super.cohort.course_assigned",
    targetType: "cohort",
    targetId: cohortId,
    details: { course_id: courseId },
  });

  return { ok: true };
}

export async function removeCourseFromCohort(cohortId: string, courseId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("cohort_courses")
    .delete()
    .eq("cohort_id", cohortId)
    .eq("course_id", courseId);
  if (error) return { error: error.message };

  const { data: cohort } = await admin
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .maybeSingle();

  await logSuperActivity({
    userId: ctx.userId,
    orgId: cohort?.org_id ?? null,
    action: "super.cohort.course_removed",
    targetType: "cohort",
    targetId: cohortId,
    details: { course_id: courseId },
  });

  return { ok: true };
}

/**
 * LMS Phase C2 — set the unlock window for a (cohort, course) assignment.
 * Reuses the existing `available_from` / `available_until` columns
 * (`date`, nullable). Pass empty string or null to clear a side. The
 * assignment must already exist; the matrix toggles existence separately.
 */
export async function updateCohortCourseSchedule(
  cohortId: string,
  courseId: string,
  schedule: {
    available_from?: string | null;
    available_until?: string | null;
    due_at?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  // Normalize empty strings to null so the date column stays clean.
  const normalize = (v: string | null | undefined) =>
    v === undefined ? undefined : v === "" ? null : v;
  const from = normalize(schedule.available_from);
  const until = normalize(schedule.available_until);
  const due = normalize(schedule.due_at);

  // Reject obvious nonsense before round-tripping the DB.
  if (from && until && until < from)
    return { error: "Available-until can't be before available-from." };
  if (from && due && due < from)
    return { error: "Due date can't be before the available-from date." };
  if (until && due && due > until)
    return { error: "Due date can't be after the available-until date." };

  const admin = createAdminClient();
  const update: {
    available_from?: string | null;
    available_until?: string | null;
    due_at?: string | null;
  } = {};
  if (from !== undefined) update.available_from = from;
  if (until !== undefined) update.available_until = until;
  if (due !== undefined) update.due_at = due;
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await admin
    .from("cohort_courses")
    .update(update)
    .eq("cohort_id", cohortId)
    .eq("course_id", courseId);
  if (error) return { error: error.message };

  const { data: cohort } = await admin
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .maybeSingle();

  await logSuperActivity({
    userId: ctx.userId,
    orgId: cohort?.org_id ?? null,
    action: "super.cohort.course_scheduled",
    targetType: "cohort",
    targetId: cohortId,
    details: { course_id: courseId, ...update },
  });

  return { ok: true };
}

export async function deletePost(postId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  // Capture details for the audit trail before deletion.
  const { data: post } = await admin
    .from("community_posts")
    .select("org_id, cohort_id, user_id")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await admin.from("community_posts").delete().eq("id", postId);
  if (error) return { error: error.message };

  await logSuperActivity({
    userId: ctx.userId,
    orgId: post?.org_id ?? null,
    action: "super.post.deleted",
    targetType: "community_post",
    targetId: postId,
    details: {
      author_user_id: post?.user_id ?? null,
      cohort_id: post?.cohort_id ?? null,
    },
  });

  revalidatePath("/super/moderation");
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("community_comments")
    .select("user_id, post_id, community_posts(org_id)")
    .eq("id", commentId)
    .maybeSingle();

  const { error } = await admin.from("community_comments").delete().eq("id", commentId);
  if (error) return { error: error.message };

  const orgId =
    (comment?.community_posts as unknown as { org_id: string | null } | null)?.org_id ?? null;

  await logSuperActivity({
    userId: ctx.userId,
    orgId,
    action: "super.comment.deleted",
    targetType: "community_comment",
    targetId: commentId,
    details: { author_user_id: comment?.user_id ?? null, post_id: comment?.post_id ?? null },
  });

  revalidatePath("/super/moderation");
  return { ok: true };
}
