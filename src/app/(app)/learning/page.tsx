import type { Metadata } from "next";
import Link from "next/link";
import { computeCourseGates } from "@/lib/learning/access-gate";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Learning — Leadership Academy" };

export default async function LearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("memberships")
    .select("cohort_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user!.id)
    .maybeSingle();

  let courses: { id: string; title: string; description: string | null; status: string }[] = [];

  if (membership?.cohort_id) {
    const { data: assigned } = await supabase
      .from("cohort_courses")
      .select("courses(id, title, description, status)")
      .eq("cohort_id", membership.cohort_id);
    courses = (assigned ?? []).map((a) => a.courses).filter(Boolean) as typeof courses;
  }

  if (profile?.super_admin) {
    const { data: all } = await supabase
      .from("courses")
      .select("id, title, description, status")
      .eq("status", "published")
      .order("order");
    courses = all ?? [];
  }

  // Get progress per course using a reliable query pattern.
  const progressMap: Record<
    string,
    { total: number; completed: number; nextLessonId?: string; nextLessonTitle?: string }
  > = {};

  for (const c of courses) {
    const { data: mods } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", c.id)
      .eq("status", "published");
    const modIds = (mods ?? []).map((m) => m.id);
    if (modIds.length === 0) {
      progressMap[c.id] = { total: 0, completed: 0 };
      continue;
    }

    const { data: courseLessons } = await supabase
      .from("lessons")
      .select("id, title")
      .in("module_id", modIds)
      .order("order");
    const { data: myProgress } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user!.id)
      .eq("completed", true);
    const completedIds = new Set((myProgress ?? []).map((p) => p.lesson_id));

    const total = courseLessons?.length ?? 0;
    const completed = (courseLessons ?? []).filter((l) => completedIds.has(l.id)).length;
    const nextLesson = (courseLessons ?? []).find((l) => !completedIds.has(l.id));

    progressMap[c.id] = {
      total,
      completed,
      nextLessonId: nextLesson?.id,
      nextLessonTitle: nextLesson?.title,
    };
  }

  // Course-level gates so the list shows lock state up front.
  const courseGates = await computeCourseGates(
    supabase,
    user!.id,
    courses.map((c) => c.id),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Learning</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Courses assigned to your cohort. Work through them at your own pace.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold text-brand-navy">No courses assigned yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600">
            Courses are assigned cohort by cohort. Yours will show up here once the LeadShift team
            or your program admin lines them up — usually ahead of the sessions they go with. If you
            were expecting one and don't see it, reach out to your program admin.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => {
            const p = progressMap[c.id] ?? { total: 0, completed: 0 };
            const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
            const isComplete = p.completed === p.total && p.total > 0;
            const gate = courseGates.get(c.id);
            const isLocked = gate ? !gate.unlocked : false;
            const lockReason =
              gate && !gate.unlocked
                ? `Finish ${gate.blockedBy.map((b) => b.title).join(", ")} first`
                : null;
            const cardInner = (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="font-semibold text-brand-navy flex items-center gap-2">
                      {isLocked && <span aria-hidden>🔒</span>}
                      {c.title}
                    </h2>
                    {c.description && (
                      <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>
                    )}
                    {isLocked && lockReason && (
                      <p className="mt-1 text-xs text-amber-700">{lockReason}</p>
                    )}
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isLocked
                        ? "text-neutral-400"
                        : isComplete
                          ? "text-emerald-600"
                          : "text-brand-blue"
                    }`}
                  >
                    {isLocked ? "Locked" : isComplete ? "✓" : `${pct}%`}
                  </span>
                </div>
                {!isLocked && p.total > 0 && (
                  <div className="mt-3 h-1.5 rounded-full bg-neutral-200">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-brand-blue"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {!isLocked && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                      {p.completed}/{p.total} lessons completed
                    </span>
                    {p.nextLessonTitle && !isComplete && (
                      <span className="text-xs text-brand-blue font-medium">
                        Continue: {p.nextLessonTitle} →
                      </span>
                    )}
                    {isComplete && (
                      <span className="text-xs text-emerald-600 font-medium">Course complete!</span>
                    )}
                  </div>
                )}
              </>
            );
            return (
              <li key={c.id}>
                {isLocked ? (
                  <div
                    aria-disabled
                    title={lockReason ?? "Locked"}
                    className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm opacity-70 cursor-not-allowed"
                  >
                    {cardInner}
                  </div>
                ) : (
                  <Link
                    href={`/learning/${c.id}`}
                    className={`block rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md ${isComplete ? "border-emerald-200" : "border-neutral-200 hover:border-brand-blue/30"}`}
                  >
                    {cardInner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
