import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Server-side data assembly for the new dashboard. Returns everything
// the new cards need in a single object so the page doesn't sprawl.
// Mirrors the existing dashboard fetch pattern but adds: active sprint
// + sprint-scoped actions, current course progress, memory facts,
// daily-challenge streak, cohort program dates, recent reflection.
//
// Returns null only when the user is unauthenticated — every downstream
// shape defaults to null/empty so cards can render their empty states
// rather than getting nullable props bubbling up through the tree.

type SB = SupabaseClient<Database>;

export type DashboardData = {
  firstName: string;
  coachName: string | null;
  // Program progression
  program: {
    week: number | null;
    total: number | null;
    capstoneDate: string | null;
  };
  // Active sprint + its linked goal + action heatmap
  activeSprint: {
    id: string;
    title: string;
    practice: string;
    actionCount: number;
    actionGoal: number;
    day: number;
    totalDays: number;
    plannedEndDate: string;
    sprintNumber: number;
    goal: { id: string; title: string };
    /** 0-indexed days within the sprint that have ≥1 action. */
    actionDays: number[];
    /** Most recent 2 sprint-scoped actions for the "Recent pauses" strip. */
    recentActions: Array<{ id: string; occurredOn: string; description: string }>;
  } | null;
  // Daily challenge — streak only; the challenge itself loads via the
  // existing /api/ai/daily-challenge endpoint from the client card.
  dailyChallengeStreak: number;
  // Most recent coach action item
  coachItem: { id: string; title: string; due_date: string | null } | null;
  lastRecapAt: string | null;
  // Most recent reflection snippet
  recentReflection: { id: string; content: string; created_at: string } | null;
  // In-progress course
  currentCourse: {
    courseId: string;
    courseTitle: string;
    moduleTitle: string | null;
    nextLesson: { id: string; title: string; durationMinutes: number | null } | null;
    percent: number;
  } | null;
  // Top memory facts
  memoryFacts: Array<{ id: string; content: string }>;
  // A count-level summary of what the thought partner has in its
  // per-turn context. Lets the memory card render a truthful state
  // even when `learner_memory` is empty (distillation hasn't fired
  // yet) — the TP still "knows" the learner's goals, assessments,
  // reflections, etc., because those all ship in every context turn.
  contextSummary: {
    goalsActive: number;
    assessmentsIntegrated: number;
    reflectionsCount: number;
    conversationsCount: number;
    hasActiveSprint: boolean;
    profileComplete: boolean;
  };
};

export async function assembleDashboardData(
  supabase: SB,
  userId: string,
): Promise<DashboardData | null> {
  // Primary membership + cohort — drives program week + capstone date.
  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "cohort_id, cohorts(id, starts_at, ends_at, capstone_unlocks_at)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .not("cohort_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cohort = membership?.cohorts
    ? Array.isArray(membership.cohorts)
      ? membership.cohorts[0]
      : membership.cohorts
    : null;

  const program = deriveProgramWeek(cohort);

  // Primary coach — we need the coach's display name for the Coach card.
  const { data: assignment } = await supabase
    .from("coach_assignments")
    .select("profiles:coach_user_id(display_name)")
    .eq("learner_user_id", userId)
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();

  const coachProfile = (assignment?.profiles ?? null) as
    | { display_name: string | null }
    | null;
  const coachName = coachProfile?.display_name?.split(" ")[0] ?? null;

  // Learner's own name — pulled from profile; the page already has the
  // profile query but we duplicate a tiny read here so this module is
  // self-contained for downstream callers (coach learner detail, etc.)
  // can reuse it without threading profile through.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const firstName =
    profile?.display_name?.split(" ")[0] ??
    "there";

  // ── Active sprint + linked goal ───────────────────────────────────────
  const { data: sprintRow } = await supabase
    .from("goal_sprints")
    .select(
      "id, title, practice, action_count, planned_end_date, sprint_number, created_at, goals(id, title)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeSprint: DashboardData["activeSprint"] = null;
  if (sprintRow) {
    const goal = Array.isArray(sprintRow.goals) ? sprintRow.goals[0] : sprintRow.goals;
    if (goal) {
      const startedAt = new Date(sprintRow.created_at);
      const plannedEnd = new Date(sprintRow.planned_end_date);
      const totalDays = Math.max(
        1,
        Math.round(
          (plannedEnd.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      const elapsed = Math.floor(
        (Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const day = Math.max(0, Math.min(totalDays, elapsed));

      // A reasonable action goal — two actions a week maps to a 14-count
      // goal on the classic 28-day sprint. If we added an `action_goal`
      // column to goal_sprints later, swap this for the column value.
      const actionGoal = Math.max(4, Math.round(totalDays / 2));

      // Pull actions scoped to this sprint for both heatmap + "recent
      // pauses" strip. Scoped so sprint stats don't accumulate actions
      // from prior sprints.
      const { data: actionsRaw } = await supabase
        .from("action_logs")
        .select("id, occurred_on, description")
        .eq("user_id", userId)
        .eq("sprint_id", sprintRow.id)
        .order("occurred_on", { ascending: false })
        .limit(60);
      const actions = actionsRaw ?? [];

      const actionDays = new Set<number>();
      for (const a of actions) {
        const dayOffset = Math.floor(
          (new Date(a.occurred_on).getTime() - startedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (dayOffset >= 0 && dayOffset < totalDays) actionDays.add(dayOffset);
      }

      activeSprint = {
        id: sprintRow.id,
        title: sprintRow.title,
        practice: sprintRow.practice,
        actionCount: sprintRow.action_count,
        actionGoal,
        day,
        totalDays,
        plannedEndDate: sprintRow.planned_end_date,
        sprintNumber: sprintRow.sprint_number,
        goal: { id: goal.id, title: goal.title },
        actionDays: Array.from(actionDays).sort((a, b) => a - b),
        recentActions: actions.slice(0, 2).map((a) => ({
          id: a.id,
          occurredOn: a.occurred_on,
          description: a.description,
        })),
      };
    }
  }

  // ── Daily challenge streak ────────────────────────────────────────────
  // Count completed daily_challenges in the last 7 days. A pragmatic
  // approximation of "streak" — doesn't enforce consecutive days, just
  // rewards frequent engagement. Swap for a trailing-consecutive-count
  // if the product wants a strict streak.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { count: streakCount } = await supabase
    .from("daily_challenges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("for_date", sevenDaysAgo);
  const dailyChallengeStreak = streakCount ?? 0;

  // ── Coach action item + last recap ────────────────────────────────────
  const { data: coachItem } = await supabase
    .from("action_items")
    .select("id, title, due_date")
    .eq("learner_user_id", userId)
    .eq("completed", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { data: recap } = await supabase
    .from("session_recaps")
    .select("created_at")
    .eq("learner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Most recent reflection ────────────────────────────────────────────
  const { data: reflection } = await supabase
    .from("reflections")
    .select("id, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Current course — most-recently-touched lesson with progress < 100.
  // We read lesson_progress, pick the most recent row the learner hasn't
  // completed, and walk up to the lesson / module / course titles.
  const { data: inProgress } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, completed, completed_at, started_at, last_scroll_pct, lessons(id, title, duration_minutes, modules(id, title, course_id, courses(id, title)))",
    )
    .eq("user_id", userId)
    .eq("completed", false)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let currentCourse: DashboardData["currentCourse"] = null;
  if (inProgress?.lessons) {
    const lesson = Array.isArray(inProgress.lessons)
      ? inProgress.lessons[0]
      : inProgress.lessons;
    const mod = lesson?.modules
      ? Array.isArray(lesson.modules)
        ? lesson.modules[0]
        : lesson.modules
      : null;
    const course = mod?.courses
      ? Array.isArray(mod.courses)
        ? mod.courses[0]
        : mod.courses
      : null;

    if (course && lesson) {
      // Percent complete for the *course*: count completed lessons vs.
      // total. One extra query, but keeps the card honest — learners
      // would notice a course at 2% progress with "next lesson" listed.
      const { data: allLessons } = await supabase
        .from("lessons")
        .select("id, modules!inner(course_id)")
        .eq("modules.course_id", course.id);
      const total = allLessons?.length ?? 0;
      const lessonIds = (allLessons ?? []).map((l) => l.id);
      let completedCount = 0;
      if (lessonIds.length > 0) {
        const { count } = await supabase
          .from("lesson_progress")
          .select("lesson_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("completed", true)
          .in("lesson_id", lessonIds);
        completedCount = count ?? 0;
      }
      const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

      currentCourse = {
        courseId: course.id,
        courseTitle: course.title,
        moduleTitle: mod?.title ?? null,
        nextLesson: {
          id: lesson.id,
          title: lesson.title,
          durationMinutes: lesson.duration_minutes ?? null,
        },
        percent,
      };
    }
  }

  // ── Top memory facts ──────────────────────────────────────────────────
  const { data: factsRaw } = await supabase
    .from("learner_memory")
    .select("id, content, confidence, created_at")
    .eq("user_id", userId)
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);

  // ── Context summary ───────────────────────────────────────────────────
  // Counts + flags that let the memory card describe what the TP actually
  // has in its per-turn context, even before any facts have been distilled.
  // These are `head: true` queries so they're cheap — no rows returned.
  const [
    { count: goalsActiveCount },
    { data: assessmentDocs },
    { count: reflectionsCount },
    { count: conversationsCount },
    { data: profileFlag },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["not_started", "in_progress"]),
    supabase
      .from("assessments")
      .select("assessment_documents(status)")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("reflections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("intake_completed_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const assessmentsIntegrated = (
    (assessmentDocs?.assessment_documents ?? []) as Array<{ status: string }>
  ).filter((d) => d.status === "ready").length;

  return {
    firstName,
    coachName,
    program,
    activeSprint,
    dailyChallengeStreak,
    coachItem: coachItem ?? null,
    lastRecapAt: recap?.created_at ?? null,
    recentReflection: reflection ?? null,
    currentCourse,
    memoryFacts: (factsRaw ?? []).map((f) => ({ id: f.id, content: f.content })),
    contextSummary: {
      goalsActive: goalsActiveCount ?? 0,
      assessmentsIntegrated,
      reflectionsCount: reflectionsCount ?? 0,
      conversationsCount: conversationsCount ?? 0,
      hasActiveSprint: !!activeSprint,
      profileComplete: !!profileFlag?.intake_completed_at,
    },
  };
}

// Compute program week + total from cohort start/end dates. When the
// cohort doesn't have dates set, both come back null and the greeting
// strip / arc strip degrade gracefully.
function deriveProgramWeek(
  cohort: {
    starts_at: string | null;
    ends_at: string | null;
    capstone_unlocks_at: string | null;
  } | null,
): { week: number | null; total: number | null; capstoneDate: string | null } {
  if (!cohort) return { week: null, total: null, capstoneDate: null };
  const start = cohort.starts_at ? new Date(cohort.starts_at) : null;
  const end = cohort.ends_at ? new Date(cohort.ends_at) : null;
  if (!start || !end) {
    return { week: null, total: null, capstoneDate: cohort.capstone_unlocks_at };
  }
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerWeek));
  const now = Date.now();
  const elapsedWeeks = Math.floor((now - start.getTime()) / msPerWeek) + 1;
  const week = Math.max(1, Math.min(total, elapsedWeeks));
  return { week, total, capstoneDate: cohort.capstone_unlocks_at };
}
