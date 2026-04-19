import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { NudgeCandidate, NudgePattern } from "./types";

export type DetectorArgs = {
  supabase: SupabaseClient<Database>;
  userId: string;
  now: Date;
};

export type Detector = (args: DetectorArgs) => Promise<NudgeCandidate | null>;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgoDate = (days: number, now: Date): string =>
  new Date(now.getTime() - days * DAY_MS).toISOString();
const daysAgoDateOnly = (days: number, now: Date): string =>
  new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);

/**
 * Active sprint whose planned_end_date is within 3 days AND has logged at
 * least one action this sprint. Celebratory check-in to close out.
 */
export const detectSprintEndingSoon: Detector = async ({ supabase, userId, now }) => {
  const todayIso = now.toISOString().slice(0, 10);
  const in3Days = new Date(now.getTime() + 3 * DAY_MS).toISOString().slice(0, 10);

  const { data: sprints } = await supabase
    .from("goal_sprints")
    .select("id, goal_id, title, practice, planned_end_date, action_count, goals(title)")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("planned_end_date", todayIso)
    .lte("planned_end_date", in3Days);
  if (!sprints || sprints.length === 0) return null;

  for (const sprint of sprints) {
    if (sprint.action_count === 0) continue;
    const goal = sprint.goals as { title: string } | null;
    const goalTitle = goal?.title ?? "your goal";
    return {
      pattern: "sprint_ending_soon",
      targetId: sprint.id,
      title: `Your sprint wraps up soon`,
      body: `"${truncate(sprint.title, 60)}" ends ${sprint.planned_end_date}. Worth taking stock of what it taught you.`,
      patternData: {
        sprint_id: sprint.id,
        goal_id: sprint.goal_id,
        goal_title: goalTitle,
        sprint_title: sprint.title,
        practice: sprint.practice,
        planned_end_date: sprint.planned_end_date,
        action_count: sprint.action_count,
      },
    };
  }
  return null;
};

/**
 * Active sprint whose planned_end_date passed more than 3 days ago. The
 * sprint needs to be closed out and the next one named.
 */
export const detectSprintNeedsReview: Detector = async ({ supabase, userId, now }) => {
  const threeDaysAgo = daysAgoDateOnly(3, now);

  const { data: sprints } = await supabase
    .from("goal_sprints")
    .select("id, goal_id, title, practice, planned_end_date, action_count, goals(title)")
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("planned_end_date", threeDaysAgo);
  if (!sprints || sprints.length === 0) return null;

  const sprint = sprints[0];
  const goal = sprint.goals as { title: string } | null;
  const goalTitle = goal?.title ?? "your goal";
  return {
    pattern: "sprint_needs_review",
    targetId: sprint.id,
    title: "Your sprint wrapped — what's next?",
    body: `"${truncate(sprint.title, 60)}" is past its planned end. Close it out and name what you want to practice next.`,
    patternData: {
      sprint_id: sprint.id,
      goal_id: sprint.goal_id,
      goal_title: goalTitle,
      sprint_title: sprint.title,
      practice: sprint.practice,
      planned_end_date: sprint.planned_end_date,
      action_count: sprint.action_count,
    },
  };
};

/**
 * A daily challenge from yesterday (or earlier, within the last 3 days) is
 * still unmarked. Reframed as a reflection prompt, not a completion chaser.
 */
export const detectChallengeFollowup: Detector = async ({ supabase, userId, now }) => {
  const yesterday = daysAgoDateOnly(1, now);
  const threeDaysAgo = daysAgoDateOnly(3, now);

  const { data } = await supabase
    .from("daily_challenges")
    .select("id, challenge, for_date, completed")
    .eq("user_id", userId)
    .eq("completed", false)
    .gte("for_date", threeDaysAgo)
    .lte("for_date", yesterday)
    .order("for_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  return {
    pattern: "challenge_followup",
    targetId: data.id,
    title: "How did your challenge land?",
    body: `"${truncate(data.challenge, 140)}" — whether it happened or not, your thought partner wants to hear how it went.`,
    patternData: {
      challenge_id: data.id,
      challenge_text: data.challenge,
      for_date: data.for_date,
    },
  };
};

/**
 * At least one assessment report uploaded ≥7 days ago, and no
 * assessment-mode conversation since that upload.
 */
export const detectUndebriefedAssessment: Detector = async ({ supabase, userId, now }) => {
  const sevenDaysAgo = daysAgoDate(7, now);

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!assessment) return null;

  const { data: oldestReady } = await supabase
    .from("assessment_documents")
    .select("id, type, processed_at")
    .eq("assessment_id", assessment.id)
    .eq("status", "ready")
    .not("processed_at", "is", null)
    .lte("processed_at", sevenDaysAgo)
    .order("processed_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!oldestReady?.processed_at) return null;

  const { count: debriefCount } = await supabase
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("mode", "assessment")
    .gte("created_at", oldestReady.processed_at);
  if ((debriefCount ?? 0) > 0) return null;

  return {
    pattern: "undebriefed_assessment",
    targetId: assessment.id,
    title: "Your assessments are waiting to be unpacked",
    body: "You uploaded a report a while back but haven't walked through it with your thought partner yet. Worth 15 minutes.",
    patternData: { assessment_id: assessment.id },
  };
};

/**
 * Active sprint whose planned_end_date is still in the future AND no
 * action logged against the sprint (or its goal) in the last 10 days.
 * Gentle push — not "you're failing", more "what's getting in the way."
 */
export const detectSprintQuiet: Detector = async ({ supabase, userId, now }) => {
  const todayIso = now.toISOString().slice(0, 10);
  const tenDaysAgo = daysAgoDate(10, now);
  // A brand-new sprint trivially has "no action in 10 days" because it
  // hasn't existed that long. Only consider sprints that have had time
  // for the learner to get going.
  const sprintAgeCutoff = daysAgoDate(10, now);

  const { data: sprints } = await supabase
    .from("goal_sprints")
    .select("id, goal_id, title, practice, planned_end_date, goals(title)")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("planned_end_date", todayIso)
    .lte("created_at", sprintAgeCutoff);
  if (!sprints || sprints.length === 0) return null;

  for (const sprint of sprints) {
    const { data: recent } = await supabase
      .from("action_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("goal_id", sprint.goal_id)
      .gte("created_at", tenDaysAgo)
      .limit(1);
    if (recent && recent.length > 0) continue;

    const goal = sprint.goals as { title: string } | null;
    const goalTitle = goal?.title ?? "your goal";
    return {
      pattern: "sprint_quiet",
      targetId: sprint.id,
      title: `Quiet on "${truncate(sprint.title, 50)}"`,
      body: "You're mid-sprint but haven't logged anything in a while. Want to talk through what's getting in the way?",
      patternData: {
        sprint_id: sprint.id,
        goal_id: sprint.goal_id,
        goal_title: goalTitle,
        sprint_title: sprint.title,
        practice: sprint.practice,
        planned_end_date: sprint.planned_end_date,
      },
    };
  }
  return null;
};

/**
 * Learner had 3+ reflections in the 14-day window ending 7 days ago, and
 * zero reflections in the last 7 days. A broken streak worth noticing.
 */
export const detectReflectionStreakBroken: Detector = async ({ supabase, userId, now }) => {
  const sevenDaysAgo = daysAgoDate(7, now);
  const twentyOneDaysAgo = daysAgoDate(21, now);

  const { count: recent } = await supabase
    .from("reflections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo);
  if ((recent ?? 0) > 0) return null;

  const { count: priorWindow } = await supabase
    .from("reflections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", twentyOneDaysAgo)
    .lt("created_at", sevenDaysAgo);
  if ((priorWindow ?? 0) < 3) return null;

  return {
    pattern: "reflection_streak_broken",
    targetId: null,
    title: "Your reflection rhythm has gone quiet",
    body: "You were journaling regularly and then stopped this week. Not a problem — just a moment worth noticing.",
    patternData: { prior_window_count: priorWindow ?? 0 },
  };
};

/**
 * A course assigned to the learner's cohort ≥3 days ago has zero lesson
 * progress rows for this learner.
 */
export const detectNewCourseWaiting: Detector = async ({ supabase, userId, now }) => {
  const { data: membership } = await supabase
    .from("memberships")
    .select("cohort_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership?.cohort_id) return null;

  const threeDaysAgo = daysAgoDate(3, now);
  const { data: cohortCourses } = await supabase
    .from("cohort_courses")
    .select("course_id, created_at, courses(id, title)")
    .eq("cohort_id", membership.cohort_id)
    .lte("created_at", threeDaysAgo);
  if (!cohortCourses || cohortCourses.length === 0) return null;

  for (const cc of cohortCourses) {
    const course = cc.courses as { id: string; title: string } | null;
    if (!course) continue;

    // Any lesson progress for this course by this learner?
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("id, lessons!inner(modules!inner(course_id))")
      .eq("user_id", userId)
      .eq("lessons.modules.course_id", course.id)
      .limit(1);
    if (progress && progress.length > 0) continue;

    return {
      pattern: "new_course_waiting",
      targetId: course.id,
      title: `"${truncate(course.title, 60)}" is waiting for you`,
      body: "This course was assigned to your cohort but you haven't opened it yet. Even 10 minutes of the first lesson counts.",
      patternData: { course_id: course.id, course_title: course.title },
    };
  }
  return null;
};

/**
 * Learner logged 4+ actions in the last 7 days. Celebratory nudge.
 */
export const detectMomentumSurge: Detector = async ({ supabase, userId, now }) => {
  const sevenDaysAgo = daysAgoDate(7, now);
  const { count } = await supabase
    .from("action_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo);
  if ((count ?? 0) < 4) return null;

  return {
    pattern: "momentum_surge",
    targetId: null,
    title: "You're on a run this week",
    body: `${count} actions logged in the last 7 days. Worth stepping back to notice what's working.`,
    patternData: { action_count: count ?? 0 },
  };
};

/**
 * Active goal with NO active sprint AND no action in 45+ days. Soft
 * "how's it landing" — doesn't imply stalling, because these are
 * program-long goals by design. Goals mid-sprint get sprint_quiet instead.
 */
export const detectGoalCheckIn: Detector = async ({ supabase, userId, now }) => {
  const fortyFiveDaysAgo = daysAgoDate(45, now);

  // Only consider goals that have existed for at least 45 days. A brand-new
  // goal trivially has "no action in 45 days" because it's been around for
  // five minutes — firing this nudge on a just-created goal reads as the
  // thought partner ghosting the learner seconds after a conversation.
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, goal_sprints(id, status)")
    .eq("user_id", userId)
    .in("status", ["not_started", "in_progress"])
    .lte("created_at", fortyFiveDaysAgo);
  if (!goals || goals.length === 0) return null;

  for (const goal of goals) {
    const sprints = (goal.goal_sprints ?? []) as Array<{ status: string }>;
    const hasActiveSprint = sprints.some((s) => s.status === "active");
    if (hasActiveSprint) continue;

    const { data: recent } = await supabase
      .from("action_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("goal_id", goal.id)
      .gte("created_at", fortyFiveDaysAgo)
      .limit(1);
    if (!recent || recent.length === 0) {
      return {
        pattern: "goal_check_in",
        targetId: goal.id,
        title: `How's "${truncate(goal.title, 40)}" landing?`,
        body: "It's been a while since you logged anything here. A check-in doesn't have to be a status report — how's it sitting with you?",
        patternData: { goal_id: goal.id, goal_title: goal.title },
      };
    }
  }
  return null;
};

export const DETECTORS: Record<NudgePattern, Detector> = {
  sprint_ending_soon: detectSprintEndingSoon,
  sprint_needs_review: detectSprintNeedsReview,
  challenge_followup: detectChallengeFollowup,
  undebriefed_assessment: detectUndebriefedAssessment,
  sprint_quiet: detectSprintQuiet,
  reflection_streak_broken: detectReflectionStreakBroken,
  new_course_waiting: detectNewCourseWaiting,
  momentum_surge: detectMomentumSurge,
  goal_check_in: detectGoalCheckIn,
};

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
