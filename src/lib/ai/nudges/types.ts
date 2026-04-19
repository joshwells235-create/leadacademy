export const NUDGE_PATTERNS = [
  "sprint_ending_soon",
  "sprint_needs_review",
  "challenge_followup",
  "undebriefed_assessment",
  "sprint_quiet",
  "reflection_streak_broken",
  "new_course_waiting",
  "momentum_surge",
  "goal_check_in",
] as const;

export type NudgePattern = (typeof NUDGE_PATTERNS)[number];

/**
 * Per-pattern cooldown in days — once fired for a given target, the same
 * pattern/target combo won't fire again for this many days.
 */
export const PATTERN_COOLDOWN_DAYS: Record<NudgePattern, number> = {
  sprint_ending_soon: 14,
  sprint_needs_review: 7,
  challenge_followup: 14,
  undebriefed_assessment: 14,
  sprint_quiet: 14,
  reflection_streak_broken: 14,
  new_course_waiting: 14,
  momentum_surge: 7,
  goal_check_in: 30,
};

/**
 * Detection priority. One nudge fires per check, first match wins.
 * Time-sensitive + specific patterns go first; celebratory + generic last.
 */
export const PATTERN_PRIORITY: NudgePattern[] = [
  "sprint_ending_soon",
  "sprint_needs_review",
  "challenge_followup",
  "undebriefed_assessment",
  "sprint_quiet",
  "reflection_streak_broken",
  "new_course_waiting",
  "momentum_surge",
  "goal_check_in",
];

/** Max nudges per rolling 7-day window per learner. */
export const GLOBAL_WEEKLY_CAP = 2;

/**
 * Output of a successful pattern detection — enough to write the
 * notification row and later resolve the click into a rich opener.
 */
export type NudgeCandidate = {
  pattern: NudgePattern;
  /** Stable id of the thing the nudge is about (goal id, sprint id, ...). */
  targetId: string | null;
  /** Static, pre-rendered headline shown on the dashboard card. */
  title: string;
  /** Static, pre-rendered body shown on the dashboard card. */
  body: string;
  /** Arbitrary JSON payload stored on coach_nudges.pattern_data, used by the
   *  opener generator to include specifics the detector already computed. */
  patternData: Record<string, unknown>;
};
