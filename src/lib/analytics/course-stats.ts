import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * LMS Phase D1 — single source of truth for course-level engagement
 * analytics. Pure aggregation layer — takes a course id and an optional
 * cohort id, returns the metrics surfaces want to render.
 *
 * Mirrors `lib/consultant/cohort-vitality.ts` in shape so the admin /
 * super / coach surfaces can render consistent numbers.
 *
 * Metric definitions:
 *  - **Enrolled**: distinct learner ids with an active membership in a
 *    cohort this course is assigned to (or, when cohortId is given,
 *    just that cohort's active learners).
 *  - **Started**: enrolled learners who have ≥1 lesson_progress row
 *    with started_at in this course.
 *  - **Completed**: enrolled learners who have lesson_progress.completed
 *    = true for every lesson in the course.
 *  - **Drop-off**: per-lesson %, in course-order. For each lesson step,
 *    what fraction of learners who started the course completed this
 *    step. Steep drops are the lessons to rework.
 *  - **Median time-to-complete**: minutes between first started_at and
 *    last completed_at, across completers only.
 *  - **Quiz pass rate**: for quiz lessons, % of attempts that passed.
 *    (First-try pass rate shown separately.)
 */

export type CourseStepStat = {
  lessonId: string;
  title: string;
  order: number;
  kind: "content" | "quiz";
  /** # learners (of enrolled) who have completed this specific lesson. */
  completed: number;
  /** # learners (of enrolled) who have started the lesson but not completed. */
  inProgress: number;
  /** Quiz-only: first-attempt pass rate across all learners. Null for content. */
  firstTryPassRate: number | null;
};

export type CourseStats = {
  courseId: string;
  cohortId: string | null;
  enrolled: number;
  started: number;
  completed: number;
  /** Median minutes from first started_at to last completed_at. Null if no completers. */
  medianMinutesToComplete: number | null;
  /** Per-lesson breakdown in course order. */
  steps: CourseStepStat[];
  /** Active learners who haven't touched a lesson in 14 days. */
  quietLearners: number;
};

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function getCourseStats(
  supabase: SupabaseClient<Database>,
  courseId: string,
  cohortId?: string,
): Promise<CourseStats> {
  // ---- Learner set: who's enrolled in this course? ----
  let learnerIds: string[] = [];
  if (cohortId) {
    const { data: members } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .eq("status", "active");
    learnerIds = (members ?? []).map((m) => m.user_id);
  } else {
    // All cohorts this course is assigned to → all their active learners.
    const { data: cohortRows } = await supabase
      .from("cohort_courses")
      .select("cohort_id")
      .eq("course_id", courseId);
    const cohortIds = (cohortRows ?? []).map((r) => r.cohort_id);
    if (cohortIds.length > 0) {
      const { data: members } = await supabase
        .from("memberships")
        .select("user_id")
        .in("cohort_id", cohortIds)
        .eq("status", "active");
      learnerIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    }
  }

  // ---- Course lessons in order ----
  const { data: modules } = await supabase
    .from("modules")
    .select("id, order")
    .eq("course_id", courseId)
    .order("order");
  const moduleIds = (modules ?? []).map((m) => m.id);
  const moduleOrderById = new Map<string, number>(
    (modules ?? []).map((m) => [m.id, m.order as number]),
  );

  const { data: lessons } =
    moduleIds.length > 0
      ? await supabase
          .from("lessons")
          .select("id, module_id, title, type, order")
          .in("module_id", moduleIds)
          .order("order")
      : { data: [] };

  // Stable course-order: sort by (module.order, lesson.order).
  const orderedLessons = (lessons ?? []).slice().sort((a, b) => {
    const am = moduleOrderById.get(a.module_id as string) ?? 0;
    const bm = moduleOrderById.get(b.module_id as string) ?? 0;
    if (am !== bm) return am - bm;
    return (a.order ?? 0) - (b.order ?? 0);
  });
  const lessonIds = orderedLessons.map((l) => l.id);

  if (learnerIds.length === 0 || lessonIds.length === 0) {
    return {
      courseId,
      cohortId: cohortId ?? null,
      enrolled: learnerIds.length,
      started: 0,
      completed: 0,
      medianMinutesToComplete: null,
      quietLearners: 0,
      steps: orderedLessons.map((l) => ({
        lessonId: l.id,
        title: l.title,
        order: l.order as number,
        kind: (l.type === "quiz" ? "quiz" : "content") as "content" | "quiz",
        completed: 0,
        inProgress: 0,
        firstTryPassRate: null,
      })),
    };
  }

  // ---- Progress rows for these learners x these lessons ----
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("user_id, lesson_id, started_at, completed, completed_at")
    .in("user_id", learnerIds)
    .in("lesson_id", lessonIds);

  type P = {
    user_id: string;
    lesson_id: string;
    started_at: string | null;
    completed: boolean;
    completed_at: string | null;
  };
  const rows = (progress ?? []) as P[];

  // Per-lesson completion + in-progress counts.
  const completedByLesson = new Map<string, Set<string>>();
  const startedByLesson = new Map<string, Set<string>>();
  for (const l of lessonIds) {
    completedByLesson.set(l, new Set());
    startedByLesson.set(l, new Set());
  }
  for (const r of rows) {
    if (r.started_at) startedByLesson.get(r.lesson_id)?.add(r.user_id);
    if (r.completed) completedByLesson.get(r.lesson_id)?.add(r.user_id);
  }

  // Started + completed at course level.
  const startedLearners = new Set<string>();
  for (const s of startedByLesson.values()) for (const u of s) startedLearners.add(u);
  // Also: anyone who has ANY completion for this course.
  for (const c of completedByLesson.values()) for (const u of c) startedLearners.add(u);

  const completedLearners = new Set<string>();
  for (const lid of lessonIds) {
    if (completedLearners.size === 0 && lid === lessonIds[0]) {
      // First pass: seed from everyone who completed the first lesson.
      const seed = completedByLesson.get(lid) ?? new Set<string>();
      for (const u of seed) completedLearners.add(u);
      continue;
    }
    const here = completedByLesson.get(lid) ?? new Set<string>();
    for (const u of Array.from(completedLearners)) {
      if (!here.has(u)) completedLearners.delete(u);
    }
  }

  // ---- Median time-to-complete (minutes) ----
  const perLearner = new Map<
    string,
    { firstStarted: number | null; lastCompleted: number | null }
  >();
  for (const r of rows) {
    const entry = perLearner.get(r.user_id) ?? { firstStarted: null, lastCompleted: null };
    if (r.started_at) {
      const t = Date.parse(r.started_at);
      if (entry.firstStarted === null || t < entry.firstStarted) entry.firstStarted = t;
    }
    if (r.completed && r.completed_at) {
      const t = Date.parse(r.completed_at);
      if (entry.lastCompleted === null || t > entry.lastCompleted) entry.lastCompleted = t;
    }
    perLearner.set(r.user_id, entry);
  }
  const durations: number[] = [];
  for (const uid of completedLearners) {
    const e = perLearner.get(uid);
    if (e?.firstStarted && e?.lastCompleted && e.lastCompleted >= e.firstStarted) {
      durations.push(Math.round((e.lastCompleted - e.firstStarted) / 60000));
    }
  }
  durations.sort((a, b) => a - b);
  const medianMinutesToComplete =
    durations.length === 0
      ? null
      : durations.length % 2 === 1
        ? durations[(durations.length - 1) / 2]
        : Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2);

  // ---- Quiet learners (enrolled, not touched in 14d) ----
  const now = Date.now();
  const touchedRecently = new Set<string>();
  for (const r of rows) {
    const t = r.completed_at
      ? Date.parse(r.completed_at)
      : r.started_at
        ? Date.parse(r.started_at)
        : 0;
    if (t > 0 && now - t < FOURTEEN_DAYS_MS) touchedRecently.add(r.user_id);
  }
  const quietLearners = learnerIds.filter((id) => !touchedRecently.has(id)).length;

  // ---- First-try quiz pass rate ----
  const quizLessonIds = orderedLessons.filter((l) => l.type === "quiz").map((l) => l.id);
  const firstTryPassByLesson = new Map<string, number>();
  if (quizLessonIds.length > 0) {
    const { data: firstAttempts } = await supabase
      .from("quiz_attempts")
      .select("lesson_id, user_id, passed, attempt_number")
      .in("lesson_id", quizLessonIds)
      .in("user_id", learnerIds)
      .eq("attempt_number", 1);
    type QA = { lesson_id: string; user_id: string; passed: boolean | null };
    const byLesson = new Map<string, { tried: number; passed: number }>();
    for (const a of (firstAttempts ?? []) as unknown as QA[]) {
      const entry = byLesson.get(a.lesson_id) ?? { tried: 0, passed: 0 };
      entry.tried += 1;
      if (a.passed === true) entry.passed += 1;
      byLesson.set(a.lesson_id, entry);
    }
    for (const [lid, counts] of byLesson) {
      if (counts.tried > 0) firstTryPassByLesson.set(lid, counts.passed / counts.tried);
    }
  }

  // ---- Per-step stats ----
  const steps: CourseStepStat[] = orderedLessons.map((l) => {
    const completed = completedByLesson.get(l.id)?.size ?? 0;
    const started = startedByLesson.get(l.id)?.size ?? 0;
    return {
      lessonId: l.id,
      title: l.title,
      order: l.order as number,
      kind: (l.type === "quiz" ? "quiz" : "content") as "content" | "quiz",
      completed,
      inProgress: Math.max(0, started - completed),
      firstTryPassRate: firstTryPassByLesson.get(l.id) ?? null,
    };
  });

  return {
    courseId,
    cohortId: cohortId ?? null,
    enrolled: learnerIds.length,
    started: startedLearners.size,
    completed: completedLearners.size,
    medianMinutesToComplete,
    quietLearners,
    steps,
  };
}
