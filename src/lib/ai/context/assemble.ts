import type { SupabaseClient } from "@supabase/supabase-js";
import { listMemoryFacts } from "@/lib/ai/memory/list-facts";
import type { Database, Json } from "@/lib/types/database";
import type {
  AssessmentKind,
  AssessmentSummary,
  LearnerContext,
  LensKey,
  ProfileContext,
} from "./types";

const MEMORY_CONTEXT_LIMIT = 15;

const RECENT_ACTIONS_LIMIT = 15;
const REFLECTIONS_LIMIT = 30;
const DAILY_CHALLENGE_WINDOW_DAYS = 7;

export async function assembleLearnerContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<LearnerContext> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - DAILY_CHALLENGE_WINDOW_DAYS);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [
    profileRes,
    membershipRes,
    assessmentRes,
    goalsRes,
    recentActionsRes,
    goalActionsRes,
    reflectionsRes,
    recapRes,
    openItemsRes,
    lastCompletedItemRes,
    currentLessonRes,
    dailyChallengesRes,
    sprintsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, timezone, role_title, function_area, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, company_size, industry, context_notes, intake_completed_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role, cohorts(name), organizations(name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase.from("assessments").select("ai_summary").eq("user_id", userId).maybeSingle(),
    supabase
      .from("goals")
      .select("id, primary_lens, title, status, target_date, smart_criteria")
      .eq("user_id", userId)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false }),
    supabase
      .from("action_logs")
      .select("description, impact_area, occurred_on, reflection, goal_id, goals(title)")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .limit(RECENT_ACTIONS_LIMIT),
    supabase
      .from("action_logs")
      .select("goal_id, occurred_on")
      .eq("user_id", userId)
      .not("goal_id", "is", null),
    supabase
      .from("reflections")
      .select("reflected_on, content, themes")
      .eq("user_id", userId)
      .order("reflected_on", { ascending: false })
      .limit(REFLECTIONS_LIMIT),
    supabase
      .from("session_recaps")
      .select("session_date, content")
      .eq("learner_user_id", userId)
      .order("session_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("action_items")
      .select("title, description, due_date, completed_at")
      .eq("learner_user_id", userId)
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("action_items")
      .select("title, description, due_date, completed_at")
      .eq("learner_user_id", userId)
      .eq("completed", true)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lesson_progress")
      .select(
        "lesson_id, completed, updated_at, lessons(title, module_id, modules(course_id, courses(title)))",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_challenges")
      .select("for_date, challenge, completed")
      .eq("user_id", userId)
      .gte("for_date", sevenDaysAgoIso)
      .order("for_date", { ascending: false }),
    supabase
      .from("goal_sprints")
      .select(
        "id, goal_id, sprint_number, title, practice, planned_end_date, actual_end_date, status, action_count, created_at",
      )
      .eq("user_id", userId)
      .order("sprint_number", { ascending: true }),
  ]);

  const identity: LearnerContext["identity"] = {
    name: profileRes.data?.display_name ?? "the learner",
    timezone: profileRes.data?.timezone ?? null,
    organization: membershipRes.data?.organizations?.name ?? null,
    cohort: membershipRes.data?.cohorts?.name ?? null,
    role: membershipRes.data?.role ?? null,
  };

  const todayDate = new Date();
  const todayCtx: LearnerContext["today"] = {
    iso: today,
    weekday: todayDate.toLocaleDateString("en-US", { weekday: "long" }),
  };

  const profile: ProfileContext = {
    roleTitle: profileRes.data?.role_title ?? null,
    functionArea: profileRes.data?.function_area ?? null,
    teamSize: profileRes.data?.team_size ?? null,
    totalOrgInfluence: profileRes.data?.total_org_influence ?? null,
    tenureAtOrg: profileRes.data?.tenure_at_org ?? null,
    tenureInLeadership: profileRes.data?.tenure_in_leadership ?? null,
    companySize: profileRes.data?.company_size ?? null,
    industry: profileRes.data?.industry ?? null,
    contextNotes: profileRes.data?.context_notes ?? null,
    intakeCompletedAt: profileRes.data?.intake_completed_at ?? null,
  };

  const assessments = parseAssessments(assessmentRes.data?.ai_summary);
  const assessmentCombinedThemes = parseCombinedThemes(assessmentRes.data?.ai_summary);

  const goalActionIndex = buildGoalActionIndex(goalActionsRes.data ?? []);
  const sprintsByGoal = buildSprintsByGoal(sprintsRes.data ?? [], today);
  const goals: LearnerContext["goals"] = (goalsRes.data ?? []).map((g) => {
    const stats = goalActionIndex.get(g.id);
    const sprintInfo = sprintsByGoal.get(g.id);
    return {
      id: g.id,
      title: g.title,
      primaryLens: (g.primary_lens as LensKey | null) ?? null,
      status: g.status,
      targetDate: g.target_date,
      smartCriteria: g.smart_criteria,
      actionCount: stats?.count ?? 0,
      daysSinceLastAction: stats ? daysBetween(stats.lastOccurredOn, today) : null,
      currentSprint: sprintInfo?.current ?? null,
      sprintHistory: sprintInfo?.history ?? [],
    };
  });

  const recentActions: LearnerContext["recentActions"] = (recentActionsRes.data ?? []).map((a) => ({
    occurredOn: a.occurred_on,
    description: a.description,
    impactArea: a.impact_area,
    reflection: a.reflection,
    goalTitle: a.goals?.title ?? null,
  }));

  const reflections: LearnerContext["reflections"] = (reflectionsRes.data ?? []).map((r) => ({
    reflectedOn: r.reflected_on,
    content: r.content,
    themes: r.themes ?? [],
  }));

  const lastSessionRecap: LearnerContext["lastSessionRecap"] = recapRes.data
    ? { sessionDate: recapRes.data.session_date, content: recapRes.data.content }
    : null;

  const openActionItems: LearnerContext["openActionItems"] = (openItemsRes.data ?? []).map((i) => ({
    title: i.title,
    description: i.description,
    dueDate: i.due_date,
    completedAt: null,
  }));

  const mostRecentCompletedActionItem: LearnerContext["mostRecentCompletedActionItem"] =
    lastCompletedItemRes.data
      ? {
          title: lastCompletedItemRes.data.title,
          description: lastCompletedItemRes.data.description,
          dueDate: lastCompletedItemRes.data.due_date,
          completedAt: lastCompletedItemRes.data.completed_at,
        }
      : null;

  const courseProgress = await resolveCourseProgress(supabase, userId, currentLessonRes.data);

  const challenges = dailyChallengesRes.data ?? [];
  const todayRow = challenges.find((c) => c.for_date === today);
  const dailyChallenge: LearnerContext["dailyChallenge"] = {
    todayChallenge: todayRow?.challenge ?? null,
    todayCompleted: todayRow?.completed ?? false,
    totalLast7Days: challenges.length,
    completedLast7Days: challenges.filter((c) => c.completed).length,
  };

  const memoryFactRows = await listMemoryFacts(supabase, userId, { limit: MEMORY_CONTEXT_LIMIT });
  const memoryFacts: LearnerContext["memoryFacts"] = memoryFactRows.map((f) => ({
    type: f.type,
    content: f.content,
    confidence: f.confidence,
    lastSeen: f.lastSeen,
    editedByUser: f.editedByUser,
  }));

  // LMS Phase D3 — recent lesson notes feed LearnerContext so the
  // thought partner is aware of what the learner is flagging in real
  // time. Cap at 10 most-recently-updated; anything older is signal-thin.
  const { data: noteRows } = await supabase
    .from("lesson_notes")
    .select("content, updated_at, lessons(title, modules(courses(title)))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);
  const lessonNotes: LearnerContext["lessonNotes"] = (
    (noteRows ?? []) as unknown as Array<{
      content: string;
      updated_at: string;
      lessons: {
        title: string;
        modules: { courses: { title: string } | { title: string }[] | null } | null;
      } | null;
    }>
  ).map((r) => {
    const courses = r.lessons?.modules?.courses;
    const courseTitle = Array.isArray(courses)
      ? (courses[0]?.title ?? null)
      : (courses?.title ?? null);
    return {
      lessonTitle: r.lessons?.title ?? "(lesson removed)",
      courseTitle,
      content: r.content,
      updatedAt: r.updated_at,
    };
  });

  return {
    identity,
    today: todayCtx,
    profile,
    assessments,
    assessmentCombinedThemes,
    goals,
    recentActions,
    reflections,
    lastSessionRecap,
    openActionItems,
    mostRecentCompletedActionItem,
    courseProgress,
    dailyChallenge,
    memoryFacts,
    lessonNotes,
  };
}

function parseCombinedThemes(
  raw: Json | null | undefined,
): LearnerContext["assessmentCombinedThemes"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const combined = (raw as Record<string, Json | undefined>)._combined_themes;
  if (!combined || typeof combined !== "object" || Array.isArray(combined)) return [];
  const themes = (combined as { themes?: unknown }).themes;
  if (!Array.isArray(themes)) return [];
  const out: LearnerContext["assessmentCombinedThemes"] = [];
  for (const t of themes) {
    if (!t || typeof t !== "object") continue;
    const theme = (t as { theme?: unknown }).theme;
    const evidence = (t as { evidence?: unknown }).evidence;
    if (typeof theme === "string" && typeof evidence === "string") {
      out.push({ theme, evidence });
    }
  }
  return out;
}

function parseAssessments(raw: Json | null | undefined): LearnerContext["assessments"] {
  const out: LearnerContext["assessments"] = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const KINDS: AssessmentKind[] = ["pi", "eqi", "threesixty"];
  for (const kind of KINDS) {
    const v = (raw as Record<string, Json | undefined>)[kind];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[kind] = v as AssessmentSummary;
    }
  }
  return out;
}

function buildGoalActionIndex(
  rows: Array<{ goal_id: string | null; occurred_on: string }>,
): Map<string, { count: number; lastOccurredOn: string }> {
  const index = new Map<string, { count: number; lastOccurredOn: string }>();
  for (const row of rows) {
    if (!row.goal_id) continue;
    const existing = index.get(row.goal_id);
    if (!existing) {
      index.set(row.goal_id, { count: 1, lastOccurredOn: row.occurred_on });
    } else {
      existing.count += 1;
      if (row.occurred_on > existing.lastOccurredOn) {
        existing.lastOccurredOn = row.occurred_on;
      }
    }
  }
  return index;
}

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = new Date(`${fromIsoDate}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

function signedDaysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = new Date(`${fromIsoDate}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

type SprintRow = {
  id: string;
  goal_id: string;
  sprint_number: number;
  title: string;
  practice: string;
  planned_end_date: string;
  actual_end_date: string | null;
  status: string;
  action_count: number;
  created_at: string;
};

type GoalSprintInfo = {
  current: LearnerContext["goals"][number]["currentSprint"];
  history: LearnerContext["goals"][number]["sprintHistory"];
};

function buildSprintsByGoal(rows: SprintRow[], today: string): Map<string, GoalSprintInfo> {
  const byGoal = new Map<string, SprintRow[]>();
  for (const r of rows) {
    const list = byGoal.get(r.goal_id) ?? [];
    list.push(r);
    byGoal.set(r.goal_id, list);
  }

  const out = new Map<string, GoalSprintInfo>();
  for (const [goalId, goalRows] of byGoal.entries()) {
    goalRows.sort((a, b) => a.sprint_number - b.sprint_number);
    const active = goalRows.find((r) => r.status === "active") ?? null;
    const history = goalRows
      .filter((r) => r.status !== "active")
      .map<GoalSprintInfo["history"][number]>((r) => ({
        sprintNumber: r.sprint_number,
        title: r.title,
        practice: r.practice,
        durationDays: r.actual_end_date
          ? daysBetween(r.created_at.slice(0, 10), r.actual_end_date)
          : daysBetween(r.created_at.slice(0, 10), r.planned_end_date),
        actionCount: r.action_count,
      }));

    let current: GoalSprintInfo["current"] = null;
    if (active) {
      const plannedTotalDays = Math.max(
        1,
        daysBetween(active.created_at.slice(0, 10), active.planned_end_date),
      );
      const dayNumber = daysBetween(active.created_at.slice(0, 10), today) + 1;
      const plannedDaysRemaining = signedDaysBetween(today, active.planned_end_date);
      current = {
        id: active.id,
        sprintNumber: active.sprint_number,
        title: active.title,
        practice: active.practice,
        plannedEndDate: active.planned_end_date,
        dayNumber,
        plannedTotalDays,
        plannedDaysRemaining,
        actionCountThisSprint: active.action_count,
      };
    }

    out.set(goalId, { current, history });
  }
  return out;
}

type CurrentLessonRow = {
  lesson_id: string;
  completed: boolean;
  updated_at: string;
  lessons: {
    title: string;
    module_id: string;
    modules: {
      course_id: string;
      courses: { title: string } | null;
    } | null;
  } | null;
} | null;

async function resolveCourseProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  currentLesson: CurrentLessonRow,
): Promise<LearnerContext["courseProgress"]> {
  if (!currentLesson?.lessons?.modules?.courses) return null;
  const courseId = currentLesson.lessons.modules.course_id;
  const courseTitle = currentLesson.lessons.modules.courses.title;
  const currentLessonTitle = currentLesson.lessons.title;

  // Total lessons in this course.
  const { count: totalCount } = await supabase
    .from("lessons")
    .select("id, modules!inner(course_id)", { count: "exact", head: true })
    .eq("modules.course_id", courseId);

  // Completed lessons in this course for this user.
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed, lessons!inner(modules!inner(course_id))")
    .eq("user_id", userId)
    .eq("completed", true)
    .eq("lessons.modules.course_id", courseId);

  return {
    courseTitle,
    currentLessonTitle,
    lessonsCompleted: progressRows?.length ?? 0,
    lessonsTotal: totalCount ?? 0,
  };
}
