import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { maybeIssueCertificate } from "./issue";

/**
 * Fire-and-forget hook called from markLessonComplete + quiz-pass
 * paths. Given a (user, lesson) that just completed, resolve the
 * parent course, try to issue a course cert, and if any assigned path
 * includes this course, also try to issue path certs for which the
 * learner has now completed every course.
 *
 * Errors are swallowed on purpose — certificate issuance is best-
 * effort and should never block the lesson-completion write.
 */
export async function onLessonCompleted(opts: { userId: string; lessonId: string }): Promise<void> {
  try {
    const admin = createAdminClient();

    // Find the lesson's parent course + the learner's current cohort.
    const { data: lessonRow } = await admin
      .from("lessons")
      .select("module_id, modules(course_id)")
      .eq("id", opts.lessonId)
      .maybeSingle();
    const courseId = (lessonRow?.modules as unknown as { course_id: string } | null)?.course_id;
    if (!courseId) return;

    const { data: membership } = await admin
      .from("memberships")
      .select("cohort_id")
      .eq("user_id", opts.userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    const cohortId = membership?.cohort_id ?? null;

    // Course cert attempt — the helper is idempotent + completion-checked.
    await maybeIssueCertificate({
      kind: "course",
      userId: opts.userId,
      courseId,
      cohortId,
    });

    // Any assigned path that includes this course — try to issue path
    // cert (helper no-ops if not every course is complete).
    if (cohortId) {
      const { data: assignedPaths } = await admin
        .from("cohort_learning_paths")
        .select("path_id, learning_paths(learning_path_courses(course_id))")
        .eq("cohort_id", cohortId);
      const pathsWithThisCourse = (
        (assignedPaths ?? []) as unknown as Array<{
          path_id: string;
          learning_paths: {
            learning_path_courses: { course_id: string }[] | null;
          } | null;
        }>
      ).filter((row) =>
        (row.learning_paths?.learning_path_courses ?? []).some((pc) => pc.course_id === courseId),
      );
      for (const row of pathsWithThisCourse) {
        await maybeIssueCertificate({
          kind: "path",
          userId: opts.userId,
          pathId: row.path_id,
          cohortId,
        });
      }
    }
  } catch {
    // Swallow — issuance is best-effort.
  }
}
