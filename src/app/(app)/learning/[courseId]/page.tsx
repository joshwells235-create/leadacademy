import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ courseId: string }> };

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, description, order, duration_minutes, learning_objectives")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("order");
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } =
    moduleIds.length > 0
      ? await supabase
          .from("lessons")
          .select("id, module_id, title, description, duration_minutes, type, order")
          .in("module_id", moduleIds)
          .order("order")
      : { data: [] };
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", user!.id)
    .eq("completed", true);
  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

  type LessonRow = {
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    type: string;
    order: number;
  };
  const lessonsByModule: Record<string, LessonRow[]> = {};
  const allLessons: LessonRow[] = [];
  for (const l of (lessons ?? []) as LessonRow[]) {
    if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
    lessonsByModule[l.module_id].push(l);
    allLessons.push(l);
  }

  // Overall progress.
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => completedIds.has(l.id)).length;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Find the first uncompleted lesson for the "Continue" button.
  const nextUncompletedLesson = allLessons.find((l) => !completedIds.has(l.id));
  // Roll up duration from lessons first, fall back to author-set module
  // duration when no lesson durations exist. Either way the learner gets
  // a real time budget instead of zero.
  const totalDuration = (modules ?? []).reduce((sum, m) => {
    const lessonsSum = (lessonsByModule[m.id] ?? []).reduce(
      (s, l) => s + (l.duration_minutes ?? 0),
      0,
    );
    return sum + (lessonsSum > 0 ? lessonsSum : (m.duration_minutes ?? 0));
  }, 0);
  const courseComplete = totalLessons > 0 && completedCount === totalLessons;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/learning" className="hover:text-brand-blue">
          Learning
        </Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{course.title}</span>
      </nav>

      <h1 className="text-2xl font-bold text-brand-navy">{course.title}</h1>
      {course.description && <p className="mt-1 text-sm text-neutral-600">{course.description}</p>}

      {courseComplete && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            🎉 You've completed every lesson in this course.
          </p>
          <p className="mt-0.5 text-xs text-emerald-800">
            Take a moment to note what stuck with you — the thought partner can help you turn it
            into a goal or practice sprint.
          </p>
        </div>
      )}

      {/* Overall progress bar + stats */}
      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-brand-navy">
            {completedCount === totalLessons && totalLessons > 0
              ? "Course complete!"
              : `${completedCount} of ${totalLessons} lessons completed`}
          </span>
          <span className="text-sm font-bold text-brand-blue">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-200">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-brand-blue"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {(modules ?? []).length} module{(modules ?? []).length !== 1 ? "s" : ""}
            {totalDuration > 0 ? ` · ~${totalDuration} min total` : ""}
          </span>
          {nextUncompletedLesson && (
            <Link
              href={`/learning/${courseId}/${nextUncompletedLesson.id}`}
              className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              {completedCount === 0 ? "Start course →" : "Continue →"}
            </Link>
          )}
        </div>
      </div>

      {/* Module list */}
      <div className="mt-6 space-y-4">
        {(modules ?? []).map((m, mIdx) => {
          const moduleLessons = lessonsByModule[m.id] ?? [];
          const done = moduleLessons.filter((l) => completedIds.has(l.id)).length;
          const allDone = done === moduleLessons.length && moduleLessons.length > 0;
          return (
            <div
              key={m.id}
              className={`rounded-lg border bg-white p-5 shadow-sm ${allDone ? "border-emerald-200" : "border-neutral-200"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400">MODULE {mIdx + 1}</span>
                    {allDone && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                        ✓ Complete
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-brand-navy">{m.title}</h2>
                  {m.description && (
                    <p className="mt-0.5 text-sm text-neutral-600">{m.description}</p>
                  )}
                  {m.learning_objectives && m.learning_objectives.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-600">
                      {m.learning_objectives.map((o) => (
                        <li key={o} className="flex items-start gap-1">
                          <span className="text-brand-blue">•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="text-xs text-neutral-500">
                  {done}/{moduleLessons.length}
                  {m.duration_minutes ? ` · ${m.duration_minutes} min` : ""}
                </span>
              </div>
              {moduleLessons.length > 0 && (
                <ul className="mt-3 space-y-0.5 border-t border-neutral-100 pt-2">
                  {moduleLessons.map((l, lIdx) => {
                    const isComplete = completedIds.has(l.id);
                    // Calculate overall lesson index for "Lesson N of M" context.
                    const overallIdx = allLessons.findIndex((al) => al.id === l.id) + 1;
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/learning/${courseId}/${l.id}`}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-brand-light transition group"
                        >
                          <span
                            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${isComplete ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 text-neutral-400 group-hover:border-brand-blue"}`}
                          >
                            {isComplete ? "✓" : overallIdx}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className={
                                isComplete
                                  ? "text-neutral-500"
                                  : "text-brand-navy group-hover:text-brand-blue"
                              }
                            >
                              {l.title}
                            </div>
                            {l.description && (
                              <div className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                                {l.description}
                              </div>
                            )}
                          </div>
                          {l.duration_minutes ? (
                            <span className="text-[10px] text-neutral-400 shrink-0">
                              {l.duration_minutes} min
                            </span>
                          ) : null}
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-xs shrink-0 ${l.type === "quiz" ? "bg-brand-pink-light text-brand-pink" : "bg-brand-blue-light text-brand-blue"}`}
                          >
                            {l.type === "quiz" ? "Quiz" : "Lesson"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
