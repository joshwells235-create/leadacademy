"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * LMS Phase C1 — author actions for lesson + course prerequisites.
 *
 * Replace-all semantics: the UI is a multi-select, so the action takes the
 * whole intended set and reconciles by deleting + inserting in a single
 * admin-client call. The DB cycle trigger (lesson_prereq_no_cycle /
 * course_prereq_no_cycle) is the ultimate guard; the action also pre-checks
 * "already required by something I'd require" to surface a friendlier error
 * before hitting the trigger.
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
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: opts.actorId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    details: (opts.details ?? {}) as never,
  });
}

// ---------------------------------------------------------------------------
// Lesson prereqs (within a course)
// ---------------------------------------------------------------------------

const setLessonPrereqsSchema = z.object({
  lessonId: z.string().uuid(),
  requiredLessonIds: z.array(z.string().uuid()).max(20),
});

export async function setLessonPrerequisites(
  input: z.infer<typeof setLessonPrereqsSchema>,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = setLessonPrereqsSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { lessonId, requiredLessonIds } = parsed.data;
  if (requiredLessonIds.includes(lessonId)) return { error: "A lesson can't require itself." };

  const admin = createAdminClient();

  // Confirm every requested required-lesson exists. Cheap defense-in-depth
  // — without it a stale UI selection could leave dangling FKs to fail at
  // insert with a less friendly message.
  if (requiredLessonIds.length > 0) {
    const { data: existing } = await admin.from("lessons").select("id").in("id", requiredLessonIds);
    const found = new Set((existing ?? []).map((l) => l.id));
    const missing = requiredLessonIds.filter((id) => !found.has(id));
    if (missing.length > 0) return { error: "One or more required lessons no longer exist." };
  }

  // Replace-all: delete then insert. Two round-trips but the table is tiny
  // and the alternative (diff-and-patch) adds bugs without saving real time.
  const { error: delErr } = await admin
    .from("lesson_prerequisites")
    .delete()
    .eq("lesson_id", lessonId);
  if (delErr) return { error: delErr.message };

  if (requiredLessonIds.length > 0) {
    const { error: insErr } = await admin.from("lesson_prerequisites").insert(
      requiredLessonIds.map((rid) => ({
        lesson_id: lessonId,
        required_lesson_id: rid,
      })),
    );
    if (insErr) {
      // The cycle trigger raises with a recognizable message — translate it
      // for the UI so the author knows what happened.
      if (insErr.message.includes("cycle"))
        return { error: "That selection would create a prerequisite loop." };
      return { error: insErr.message };
    }
  }

  // Find the parent course id so we can revalidate the right pages and
  // record a useful target on the activity log.
  const { data: lesson } = await admin
    .from("lessons")
    .select("module_id, modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const courseId = (lesson?.modules as unknown as { course_id: string } | null)?.course_id ?? null;

  await logActivity({
    actorId: ctx.userId,
    action: "super.lesson.prereqs_updated",
    targetType: "lesson",
    targetId: lessonId,
    details: { count: requiredLessonIds.length, course_id: courseId },
  });

  if (courseId) {
    revalidatePath(`/super/course-builder/${courseId}/lessons/${lessonId}`);
    revalidatePath(`/super/course-builder/${courseId}`);
    revalidatePath(`/learning/${courseId}`);
    revalidatePath(`/learning/${courseId}/${lessonId}`);
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Course prereqs (between courses)
// ---------------------------------------------------------------------------

const setCoursePrereqsSchema = z.object({
  courseId: z.string().uuid(),
  requiredCourseIds: z.array(z.string().uuid()).max(20),
});

export async function setCoursePrerequisites(
  input: z.infer<typeof setCoursePrereqsSchema>,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = setCoursePrereqsSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { courseId, requiredCourseIds } = parsed.data;
  if (requiredCourseIds.includes(courseId)) return { error: "A course can't require itself." };

  const admin = createAdminClient();

  if (requiredCourseIds.length > 0) {
    const { data: existing } = await admin.from("courses").select("id").in("id", requiredCourseIds);
    const found = new Set((existing ?? []).map((c) => c.id));
    const missing = requiredCourseIds.filter((id) => !found.has(id));
    if (missing.length > 0) return { error: "One or more required courses no longer exist." };
  }

  const { error: delErr } = await admin
    .from("course_prerequisites")
    .delete()
    .eq("course_id", courseId);
  if (delErr) return { error: delErr.message };

  if (requiredCourseIds.length > 0) {
    const { error: insErr } = await admin.from("course_prerequisites").insert(
      requiredCourseIds.map((rid) => ({
        course_id: courseId,
        required_course_id: rid,
      })),
    );
    if (insErr) {
      if (insErr.message.includes("cycle"))
        return { error: "That selection would create a prerequisite loop." };
      return { error: insErr.message };
    }
  }

  await logActivity({
    actorId: ctx.userId,
    action: "super.course.prereqs_updated",
    targetType: "course",
    targetId: courseId,
    details: { count: requiredCourseIds.length },
  });

  revalidatePath(`/super/course-builder/${courseId}`);
  revalidatePath("/super/course-builder");
  revalidatePath(`/learning/${courseId}`);
  revalidatePath("/learning");

  return { ok: true };
}
