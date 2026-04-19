import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type LessonSearchHit = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  courseId: string;
  href: string;
};

/**
 * Search lessons visible to a learner — scoped to courses assigned to their
 * active cohort. Title-substring match on lesson title, module title, and
 * course title; returns up to `limit` hits, best-matching first (lesson
 * title matches win over module/course title matches).
 *
 * Small catalog today — a simple ILIKE pass is fine. If the catalog grows
 * past a few hundred lessons, swap in pg_trgm or full-text.
 */
export async function searchLessonsForLearner(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: string,
  limit = 3,
): Promise<LessonSearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const { data: membership } = await supabase
    .from("memberships")
    .select("cohort_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership?.cohort_id) return [];

  const { data: cohortCourseRows } = await supabase
    .from("cohort_courses")
    .select("course_id")
    .eq("cohort_id", membership.cohort_id);
  const courseIds = (cohortCourseRows ?? []).map((r) => r.course_id);
  if (courseIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("lessons")
    .select("id, title, modules!inner(id, title, course_id, courses!inner(id, title))")
    .in("modules.course_id", courseIds);

  const allLessons = (rows ?? []) as unknown as Array<{
    id: string;
    title: string;
    modules: {
      id: string;
      title: string;
      course_id: string;
      courses: { id: string; title: string } | null;
    } | null;
  }>;

  const lower = term.toLowerCase();
  const scored: Array<{ score: number; hit: LessonSearchHit }> = [];
  for (const row of allLessons) {
    const mod = row.modules;
    const course = mod?.courses;
    if (!mod || !course) continue;
    const lessonLower = row.title.toLowerCase();
    const moduleLower = mod.title.toLowerCase();
    const courseLower = course.title.toLowerCase();
    let score = 0;
    if (lessonLower.includes(lower)) score += 100;
    if (moduleLower.includes(lower)) score += 25;
    if (courseLower.includes(lower)) score += 10;
    if (score === 0) continue;
    if (lessonLower === lower) score += 50;
    scored.push({
      score,
      hit: {
        lessonId: row.id,
        lessonTitle: row.title,
        moduleTitle: mod.title,
        courseTitle: course.title,
        courseId: course.id,
        href: `/learning/${course.id}/${row.id}`,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.hit);
}
