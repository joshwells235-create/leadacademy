import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { computeCourseGates } from "@/lib/learning/access-gate";
import { computeDueStatus, dueStatusChipClass, dueStatusLabel } from "@/lib/learning/due-status";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Learning — Leadership Academy" };

export default async function LearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  type ListedCourse = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    available_from: string | null;
    available_until: string | null;
    due_at: string | null;
  };
  let courses: ListedCourse[] = [];

  if (membership?.cohort_id) {
    const { data: assigned } = await supabase
      .from("cohort_courses")
      .select("available_from, available_until, due_at, courses(id, title, description, status)")
      .eq("cohort_id", membership.cohort_id);
    courses = (assigned ?? [])
      .map((a) => {
        const c = a.courses as unknown as Omit<
          ListedCourse,
          "available_from" | "available_until" | "due_at"
        > | null;
        return c
          ? {
              ...c,
              available_from: a.available_from,
              available_until: a.available_until,
              due_at: a.due_at,
            }
          : null;
      })
      .filter((c): c is ListedCourse => c !== null);
  }

  if (profile?.super_admin) {
    // Super-admin sees the full catalog with no schedule (preview mode).
    const { data: all } = await supabase
      .from("courses")
      .select("id, title, description, status")
      .eq("status", "published")
      .order("order");
    courses = (all ?? []).map((c) => ({
      ...c,
      available_from: null,
      available_until: null,
      due_at: null,
    }));
  }

  // Bucket by schedule. Today is a YYYY-MM-DD string compared against the
  // `date`-typed columns the same way Postgres would.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming: ListedCourse[] = [];
  const available: ListedCourse[] = [];
  for (const c of courses) {
    // Past available_until → hide entirely. Author set an expiration; don't
    // resurface it on the list.
    if (c.available_until && c.available_until < today) continue;
    if (c.available_from && c.available_from > today) {
      upcoming.push(c);
      continue;
    }
    available.push(c);
  }
  courses = available;

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

  // Course-level gates so the list shows lock state up front. Super-admins
  // bypass — the lesson + course page redirects already let them through, so
  // rendering lock cards in preview mode would just be misleading.
  const courseGates = profile?.super_admin
    ? new Map<string, never>()
    : await computeCourseGates(
        supabase,
        user!.id,
        courses.map((c) => c.id),
      );

  // C4: paths assigned to the learner's cohort. Each path is a sequenced
  // series of courses; the path's courses are already materialized into
  // cohort_courses so completion tracking + locks all use the existing maps.
  type PathRow = {
    path_id: string;
    available_from: string | null;
    due_at: string | null;
    learning_paths: {
      id: string;
      name: string;
      description: string | null;
      learning_path_courses: { course_id: string; order: number }[] | null;
    } | null;
  };
  let learnerPaths: {
    id: string;
    name: string;
    description: string | null;
    courseIds: string[];
    available_from: string | null;
    due_at: string | null;
  }[] = [];
  if (membership?.cohort_id) {
    const { data: pathRows } = await supabase
      .from("cohort_learning_paths")
      .select(
        "path_id, available_from, due_at, learning_paths(id, name, description, learning_path_courses(course_id, order))",
      )
      .eq("cohort_id", membership.cohort_id);
    learnerPaths = ((pathRows ?? []) as unknown as PathRow[])
      .map((r) => {
        const lp = r.learning_paths;
        if (!lp) return null;
        const orderedCourseIds = (lp.learning_path_courses ?? [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((pc) => pc.course_id);
        return {
          id: lp.id,
          name: lp.name,
          description: lp.description,
          courseIds: orderedCourseIds,
          available_from: r.available_from,
          due_at: r.due_at,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }
  // Hide paths whose available_from hasn't arrived yet.
  const visiblePaths = learnerPaths.filter((p) => !p.available_from || p.available_from <= today);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Learning</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Courses assigned to your cohort. Work through them at your own pace.
        </p>
      </div>

      {visiblePaths.length > 0 && (
        <div className="mb-6 space-y-4">
          {visiblePaths.map((path) => {
            // Compute per-course status using the existing progressMap.
            const totalCourses = path.courseIds.length;
            const courseStatuses = path.courseIds.map((cid) => {
              const cp = progressMap[cid] ?? { total: 0, completed: 0 };
              const courseDone = cp.total > 0 && cp.completed === cp.total;
              const courseStarted = cp.completed > 0;
              return { cid, done: courseDone, started: courseStarted };
            });
            const completedCount = courseStatuses.filter((s) => s.done).length;
            // "Current" is the first not-done course; everything after is gated by sequence.
            const currentIdx = courseStatuses.findIndex((s) => !s.done);
            const pathPct =
              totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0;
            const pathDue = computeDueStatus(path.due_at, completedCount === totalCourses);
            return (
              <section
                key={path.id}
                className="rounded-lg border border-brand-blue/30 bg-gradient-to-br from-brand-blue/5 to-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                      Your path
                    </span>
                    <h2 className="text-lg font-bold text-brand-navy">{path.name}</h2>
                    {path.description && (
                      <p className="mt-1 text-sm text-neutral-600">{path.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-brand-blue">{pathPct}%</span>
                    {pathDue.status !== "none" && pathDue.status !== "complete" && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dueStatusChipClass(pathDue)}`}
                      >
                        {dueStatusLabel(pathDue)}
                      </span>
                    )}
                  </div>
                </div>
                <ol className="mt-4 space-y-1">
                  {courseStatuses.map((s, idx) => {
                    const courseInfo = courses.find((c) => c.id === s.cid);
                    const upcomingPath = upcoming.find((c) => c.id === s.cid);
                    const info = courseInfo ?? upcomingPath;
                    const isCurrent = idx === currentIdx;
                    const isFutureStep = currentIdx >= 0 && idx > currentIdx;
                    return (
                      <li
                        key={s.cid}
                        className="flex items-center gap-3 rounded-md bg-white/70 px-3 py-2 text-sm"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                            s.done
                              ? "bg-emerald-500 text-white"
                              : isCurrent
                                ? "bg-brand-blue text-white"
                                : "bg-neutral-200 text-neutral-500"
                          }`}
                        >
                          {s.done ? "✓" : idx + 1}
                        </span>
                        <span
                          className={`flex-1 ${
                            s.done
                              ? "text-neutral-500"
                              : isCurrent
                                ? "font-medium text-brand-navy"
                                : "text-neutral-600"
                          }`}
                        >
                          {info?.title ?? "(unavailable course)"}
                        </span>
                        {info && !isFutureStep ? (
                          <Link
                            href={`/learning/${s.cid}`}
                            className="text-xs font-medium text-brand-blue hover:underline"
                          >
                            {s.done ? "Review" : isCurrent ? "Continue →" : "Open →"}
                          </Link>
                        ) : (
                          <span className="text-[11px] text-neutral-400">Up next</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}

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
            const due = computeDueStatus(c.due_at, isComplete);
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
                  <div className="flex flex-col items-end gap-1">
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
                    {!isLocked && due.status !== "none" && due.status !== "complete" && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dueStatusChipClass(due)}`}
                      >
                        {dueStatusLabel(due)}
                      </span>
                    )}
                  </div>
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

      {upcoming.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Coming up
          </h2>
          <ul className="space-y-3">
            {upcoming.map((c) => (
              <li key={c.id}>
                <div
                  aria-disabled
                  className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm opacity-70"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-brand-navy">{c.title}</h3>
                      {c.description && (
                        <p className="mt-1 text-sm text-neutral-600 line-clamp-2">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-amber-700">
                      Unlocks{" "}
                      {c.available_from
                        ? new Date(`${c.available_from}T00:00:00`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "soon"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
