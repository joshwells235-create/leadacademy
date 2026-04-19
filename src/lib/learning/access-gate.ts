import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single source of truth for "can this learner open this lesson / course?"
 *
 * Two flavors of prereq exist:
 *   - lesson_prerequisites: lesson A requires completion of one or more
 *     other lessons (same course, by author convention).
 *   - course_prerequisites: course X requires completion of one or more
 *     other courses end-to-end.
 *
 * "Course complete" here matches the learner-facing course overview: every
 * published lesson in the course has a completed lesson_progress row for
 * the user. The course page page.tsx already computes the same; this helper
 * keeps the rule shared so the gate and the visible progress bar agree.
 */

export type GateUnlocked = { unlocked: true };
export type GateBlocked = {
  unlocked: false;
  blockedBy: { id: string; title: string }[];
};
export type GateResult = GateUnlocked | GateBlocked;

const UNLOCKED: GateUnlocked = { unlocked: true };

/**
 * Per-lesson gates within a single course. Returns a Map keyed by lesson id.
 * A lesson missing from the map (i.e. with no prereqs configured) is unlocked.
 */
export async function computeCourseLessonGates(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase client generic
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  courseId: string,
): Promise<Map<string, GateResult>> {
  // Find every lesson in this course (ignore status — author may flip
  // a required lesson to draft and we still want to surface that as a
  // block rather than silently unlock the dependent).
  const { data: modules } = await supabase.from("modules").select("id").eq("course_id", courseId);
  const moduleIds = (modules ?? []).map((m) => m.id);
  if (moduleIds.length === 0) return new Map();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title")
    .in("module_id", moduleIds);
  const lessonRows = lessons ?? [];
  const lessonIds = lessonRows.map((l) => l.id);
  if (lessonIds.length === 0) return new Map();
  const titleById = new Map(lessonRows.map((l) => [l.id, l.title]));

  const [prereqsRes, progressRes] = await Promise.all([
    supabase
      .from("lesson_prerequisites")
      .select("lesson_id, required_lesson_id")
      .in("lesson_id", lessonIds),
    supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("lesson_id", lessonIds),
  ]);

  const completed = new Set((progressRes.data ?? []).map((p) => p.lesson_id));
  const result = new Map<string, GateResult>();

  for (const row of prereqsRes.data ?? []) {
    if (completed.has(row.required_lesson_id)) continue;
    const existing = result.get(row.lesson_id);
    const block = {
      id: row.required_lesson_id,
      title: titleById.get(row.required_lesson_id) ?? "(removed lesson)",
    };
    if (existing && !existing.unlocked) {
      // Dedup by id — a lesson can be required once per dependent.
      if (!existing.blockedBy.some((b) => b.id === block.id)) {
        existing.blockedBy.push(block);
      }
    } else {
      result.set(row.lesson_id, { unlocked: false, blockedBy: [block] });
    }
  }

  return result;
}

/**
 * Per-course gates for a set of course ids. A course is locked when it
 * has at least one course_prerequisite whose required course is not 100%
 * complete for this user. Courses with no prereqs are absent from the map
 * (treat absent as unlocked).
 */
export async function computeCourseGates(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase client generic
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  courseIds: string[],
): Promise<Map<string, GateResult>> {
  const result = new Map<string, GateResult>();
  if (courseIds.length === 0) return result;

  const { data: prereqRows } = await supabase
    .from("course_prerequisites")
    .select(
      "course_id, required_course_id, courses!course_prerequisites_required_course_id_fkey(title)",
    )
    .in("course_id", courseIds);

  // PostgREST returns the embed as an array even for to-one relations when
  // disambiguated by FK name; normalize to a single value (or null).
  const prereqs = (
    (prereqRows ?? []) as unknown as Array<{
      course_id: string;
      required_course_id: string;
      courses: { title: string } | { title: string }[] | null;
    }>
  ).map((r) => ({
    course_id: r.course_id,
    required_course_id: r.required_course_id,
    courses: Array.isArray(r.courses) ? (r.courses[0] ?? null) : r.courses,
  }));
  if (prereqs.length === 0) return result;

  // Compute completion per required course end-to-end. We only need to
  // know "complete or not" — total lessons vs completed lessons for this
  // user. Batch the lesson lookup across all required course ids.
  const requiredCourseIds = Array.from(new Set(prereqs.map((p) => p.required_course_id)));
  const { data: requiredModules } = await supabase
    .from("modules")
    .select("id, course_id")
    .in("course_id", requiredCourseIds);
  const moduleToCourse = new Map<string, string>(
    (requiredModules ?? []).map((m) => [m.id, m.course_id as string]),
  );
  const moduleIds = Array.from(moduleToCourse.keys());

  const lessonsByCourse = new Map<string, string[]>();
  if (moduleIds.length > 0) {
    const { data: requiredLessons } = await supabase
      .from("lessons")
      .select("id, module_id")
      .in("module_id", moduleIds);
    for (const l of requiredLessons ?? []) {
      const cid = moduleToCourse.get(l.module_id as string);
      if (!cid) continue;
      const arr = lessonsByCourse.get(cid) ?? [];
      arr.push(l.id);
      lessonsByCourse.set(cid, arr);
    }
  }

  // Pull learner's completion across every required-course lesson in one shot.
  const allRequiredLessonIds = Array.from(lessonsByCourse.values()).flat();
  const completed = new Set<string>();
  if (allRequiredLessonIds.length > 0) {
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("lesson_id", allRequiredLessonIds);
    for (const p of progress ?? []) completed.add(p.lesson_id);
  }

  const isCourseComplete = (cid: string) => {
    const lessons = lessonsByCourse.get(cid) ?? [];
    if (lessons.length === 0) return false; // empty required course can't be "completed"
    return lessons.every((id) => completed.has(id));
  };

  for (const p of prereqs) {
    if (isCourseComplete(p.required_course_id)) continue;
    const block = {
      id: p.required_course_id,
      title: p.courses?.title ?? "(removed course)",
    };
    const existing = result.get(p.course_id);
    if (existing && !existing.unlocked) {
      if (!existing.blockedBy.some((b) => b.id === block.id)) {
        existing.blockedBy.push(block);
      }
    } else {
      result.set(p.course_id, { unlocked: false, blockedBy: [block] });
    }
  }

  return result;
}

/**
 * Convenience: combined gate for a single lesson page. Returns blocked if
 * either the parent course is gated or the lesson itself is gated. The
 * server-side lesson page uses this to decide whether to redirect.
 */
export async function computeSingleLessonGate(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase client generic
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  lessonId: string,
): Promise<GateResult & { courseId: string | null }> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, module_id, modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const courseId = (lesson?.modules as unknown as { course_id: string } | null)?.course_id ?? null;
  if (!courseId) return { ...UNLOCKED, courseId };

  const [courseGates, lessonGates] = await Promise.all([
    computeCourseGates(supabase, userId, [courseId]),
    computeCourseLessonGates(supabase, userId, courseId),
  ]);

  const blockers: { id: string; title: string }[] = [];
  const courseGate = courseGates.get(courseId);
  if (courseGate && !courseGate.unlocked) blockers.push(...courseGate.blockedBy);
  const lessonGate = lessonGates.get(lessonId);
  if (lessonGate && !lessonGate.unlocked) blockers.push(...lessonGate.blockedBy);

  if (blockers.length === 0) return { ...UNLOCKED, courseId };
  return { unlocked: false, blockedBy: blockers, courseId };
}
