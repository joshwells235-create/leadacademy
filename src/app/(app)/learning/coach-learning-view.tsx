import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Learning page for coach-primary users. Coaches aren't enrolled — they see
 * the published catalog for reference, plus a roll-up of what each coachee
 * is working through. No progress bars on the catalog cards (they'd always
 * be 0%); no cohort-scoped schedule (coaches can reference anything).
 */
export async function CoachLearningView({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: catalog }, { data: assignments }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description")
      .eq("status", "published")
      .order("order"),
    supabase
      .from("coach_assignments")
      .select("learner_user_id, cohorts(id, name)")
      .eq("coach_user_id", userId)
      .is("active_to", null),
  ]);

  const courses = catalog ?? [];
  const learnerIds = Array.from(new Set((assignments ?? []).map((a) => a.learner_user_id)));

  // Roll up progress per course across coachees. We aggregate lesson counts
  // directly rather than re-using the learner view's per-course loop — for a
  // caseload of N learners × M courses the roll-up gets expensive otherwise.
  type CourseRollup = {
    courseId: string;
    totalCoachees: number;
    startedCount: number;
    completedCount: number;
  };
  const rollupByCourse = new Map<string, CourseRollup>();
  for (const c of courses) {
    rollupByCourse.set(c.id, {
      courseId: c.id,
      totalCoachees: learnerIds.length,
      startedCount: 0,
      completedCount: 0,
    });
  }

  if (learnerIds.length > 0 && courses.length > 0) {
    // For each course: how many lessons total, and how many each coachee has
    // completed. Started = ≥1 lesson_progress row for the course; completed =
    // all lessons completed.
    const { data: modules } = await supabase
      .from("modules")
      .select("id, course_id")
      .in("course_id", courses.map((c) => c.id))
      .eq("status", "published");
    const modsByCourse = new Map<string, string[]>();
    for (const m of modules ?? []) {
      const list = modsByCourse.get(m.course_id) ?? [];
      list.push(m.id);
      modsByCourse.set(m.course_id, list);
    }
    const allModIds = (modules ?? []).map((m) => m.id);

    const { data: lessons } =
      allModIds.length > 0
        ? await supabase.from("lessons").select("id, module_id").in("module_id", allModIds)
        : { data: [] };
    const lessonsByCourse = new Map<string, Set<string>>();
    for (const l of lessons ?? []) {
      // Find which course this lesson belongs to via module_id.
      for (const [courseId, modIds] of modsByCourse.entries()) {
        if (modIds.includes(l.module_id)) {
          const set = lessonsByCourse.get(courseId) ?? new Set();
          set.add(l.id);
          lessonsByCourse.set(courseId, set);
          break;
        }
      }
    }

    const allLessonIds = (lessons ?? []).map((l) => l.id);
    const { data: progress } =
      allLessonIds.length > 0
        ? await supabase
            .from("lesson_progress")
            .select("user_id, lesson_id, completed")
            .in("user_id", learnerIds)
            .in("lesson_id", allLessonIds)
        : { data: [] };

    // per (userId, courseId): count completed lessons
    const completedPerUserCourse = new Map<string, number>();
    const startedUserCourses = new Set<string>();
    for (const p of progress ?? []) {
      for (const [courseId, lessonSet] of lessonsByCourse.entries()) {
        if (lessonSet.has(p.lesson_id)) {
          const key = `${p.user_id}:${courseId}`;
          startedUserCourses.add(key);
          if (p.completed) {
            completedPerUserCourse.set(key, (completedPerUserCourse.get(key) ?? 0) + 1);
          }
          break;
        }
      }
    }

    for (const c of courses) {
      const totalLessons = lessonsByCourse.get(c.id)?.size ?? 0;
      const roll = rollupByCourse.get(c.id);
      if (!roll) continue;
      for (const learnerId of learnerIds) {
        const key = `${learnerId}:${c.id}`;
        if (startedUserCourses.has(key)) roll.startedCount += 1;
        if (totalLessons > 0 && completedPerUserCourse.get(key) === totalLessons) {
          roll.completedCount += 1;
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Learning</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Browse the catalog your coachees work through. Click any course to preview lessons and
          reference the content in your coaching conversations.
        </p>
      </div>

      {learnerIds.length > 0 && courses.length > 0 && (
        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-brand-navy">Your coachees' progress</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Across your {learnerIds.length} active coachee{learnerIds.length === 1 ? "" : "s"}.
          </p>
          <ul className="mt-4 divide-y divide-neutral-100">
            {courses.map((c) => {
              const roll = rollupByCourse.get(c.id);
              if (!roll) return null;
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <Link
                    href={`/learning/${c.id}`}
                    className="flex-1 truncate text-brand-navy hover:text-brand-blue"
                  >
                    {c.title}
                  </Link>
                  <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                    {roll.completedCount} done · {roll.startedCount - roll.completedCount} in
                    progress
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Catalog
        </h2>
        {courses.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-neutral-600">No published courses yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/learning/${c.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/30 hover:shadow-md"
                >
                  <h3 className="font-semibold text-brand-navy">{c.title}</h3>
                  {c.description && (
                    <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
