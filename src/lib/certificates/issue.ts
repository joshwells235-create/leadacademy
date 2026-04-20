import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * LMS Phase C5 — certificate issuance.
 *
 * Design:
 *  - Issues a NEW row per issuance (never mutates). Re-cert after expiry
 *    inserts a fresh row; audit trail stays intact, "current holders"
 *    trivially queryable via `revoked_at is null and (expires_at is null
 *    or expires_at > now())`.
 *  - Idempotent on first pass: if the learner already has an active,
 *    non-expired, non-revoked certificate for this course/path, returns
 *    it without re-issuing.
 *  - PDF rendering is fire-and-forget from the caller — we write the
 *    `certificates` row first (the PDF is regenerable from the row
 *    data), then kick off PDF render + storage upload in the
 *    background. `pdf_url` is null until that completes; the download
 *    route will render on demand if null.
 *
 * Called by markLessonComplete + submitQuizAttempt (course certs) and
 * by assignPathToCohort / course-completion watchers (path certs).
 */

type IssueInput =
  | { kind: "course"; userId: string; courseId: string; cohortId?: string | null }
  | { kind: "path"; userId: string; pathId: string; cohortId?: string | null };

/**
 * Attempt to issue a certificate. No-op when the relevant completion
 * criteria aren't met (e.g. user hasn't finished every lesson).
 * Returns the active certificate (new or existing) or `null` if nothing
 * was issuable.
 */
export async function maybeIssueCertificate(
  input: IssueInput,
): Promise<{ id: string; created: boolean } | null> {
  const admin = createAdminClient();

  // Completion check — every published lesson in the course (or across
  // every course in the path) must have a completed lesson_progress row
  // for this user.
  const eligible = await checkEligible(admin, input);
  if (!eligible) return null;

  // Is there already an active, non-expired, non-revoked certificate?
  const existingQuery = admin
    .from("certificates")
    .select("id, issued_at, expires_at, revoked_at")
    .eq("user_id", input.userId)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false })
    .limit(1);
  const { data: existing } =
    input.kind === "course"
      ? await existingQuery.eq("course_id", input.courseId)
      : await existingQuery.eq("path_id", input.pathId);
  const active = (existing ?? []).find((c) => {
    if (!c.expires_at) return true;
    return new Date(c.expires_at).getTime() > Date.now();
  });
  if (active) return { id: active.id, created: false };

  // Look up validity window to stamp expires_at.
  const validityMonths = await lookupValidityMonths(admin, input);
  const issuedAt = new Date();
  const expiresAt =
    validityMonths && validityMonths > 0 ? addMonths(issuedAt, validityMonths).toISOString() : null;

  const insertPayload =
    input.kind === "course"
      ? {
          user_id: input.userId,
          course_id: input.courseId,
          cohort_id: input.cohortId ?? null,
          issued_at: issuedAt.toISOString(),
          expires_at: expiresAt,
        }
      : {
          user_id: input.userId,
          path_id: input.pathId,
          cohort_id: input.cohortId ?? null,
          issued_at: issuedAt.toISOString(),
          expires_at: expiresAt,
        };

  const { data: inserted, error } = await admin
    .from("certificates")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !inserted) return null;

  return { id: inserted.id, created: true };
}

async function checkEligible(
  // biome-ignore lint/suspicious/noExplicitAny: admin client row typing
  admin: any,
  input: IssueInput,
): Promise<boolean> {
  if (input.kind === "course") {
    const lessonIds = await getCourseLessonIds(admin, input.courseId);
    if (lessonIds.length === 0) return false;
    return hasCompletedAll(admin, input.userId, lessonIds);
  }
  // Path: need every course's every lesson complete.
  const { data: pathCourses } = await admin
    .from("learning_path_courses")
    .select("course_id")
    .eq("path_id", input.pathId);
  const courseIds = (pathCourses ?? []).map((p: { course_id: string }) => p.course_id);
  if (courseIds.length === 0) return false;
  const allLessonIds: string[] = [];
  for (const cid of courseIds) {
    const lessonIds = await getCourseLessonIds(admin, cid);
    if (lessonIds.length === 0) return false;
    allLessonIds.push(...lessonIds);
  }
  return hasCompletedAll(admin, input.userId, allLessonIds);
}

async function getCourseLessonIds(
  // biome-ignore lint/suspicious/noExplicitAny: admin client row typing
  admin: any,
  courseId: string,
): Promise<string[]> {
  const { data: modules } = await admin.from("modules").select("id").eq("course_id", courseId);
  const moduleIds = (modules ?? []).map((m: { id: string }) => m.id);
  if (moduleIds.length === 0) return [];
  const { data: lessons } = await admin.from("lessons").select("id").in("module_id", moduleIds);
  return (lessons ?? []).map((l: { id: string }) => l.id);
}

async function hasCompletedAll(
  // biome-ignore lint/suspicious/noExplicitAny: admin client row typing
  admin: any,
  userId: string,
  lessonIds: string[],
): Promise<boolean> {
  if (lessonIds.length === 0) return false;
  const { data: progress } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("completed", true)
    .in("lesson_id", lessonIds);
  const completed = new Set((progress ?? []).map((p: { lesson_id: string }) => p.lesson_id));
  return lessonIds.every((id) => completed.has(id));
}

async function lookupValidityMonths(
  // biome-ignore lint/suspicious/noExplicitAny: admin client row typing
  admin: any,
  input: IssueInput,
): Promise<number | null> {
  if (input.kind === "course") {
    const { data } = await admin
      .from("courses")
      .select("cert_validity_months")
      .eq("id", input.courseId)
      .maybeSingle();
    return data?.cert_validity_months ?? null;
  }
  const { data } = await admin
    .from("learning_paths")
    .select("cert_validity_months")
    .eq("id", input.pathId)
    .maybeSingle();
  return data?.cert_validity_months ?? null;
}

/**
 * Calendar-month addition. If the target day-of-month doesn't exist
 * (e.g. March 31 + 1 month), Date overflow lands us in the next month;
 * clamp to the last day of the target month instead so learners aren't
 * surprised by an expiration shift.
 */
function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  const targetMonth = n.getMonth() + months;
  const targetYear = n.getFullYear();
  const desiredDay = n.getDate();
  n.setDate(1);
  n.setMonth(targetMonth);
  const daysInTarget = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  n.setDate(Math.min(desiredDay, daysInTarget));
  // Make sure we're not drifting across DST weirdness — force the time
  // to the same hh:mm:ss the caller passed in.
  n.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  // Year calc for edge cases already handled by setMonth rolling forward.
  void targetYear;
  return n;
}
