import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { assembleLearnerContext } from "@/lib/ai/context/assemble";
import { formatLearnerContext } from "@/lib/ai/context/format";
import { logAiError } from "@/lib/ai/errors/log-error";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import type { Database } from "@/lib/types/database";
import type { NudgePattern } from "./types";

const PATTERN_GUIDANCE: Record<NudgePattern, string> = {
  sprint_ending_soon: `The learner's current sprint is ending within 3 days and they HAVE been logging actions against it. Open with a celebratory check-in — recognize what they've put into this chapter — then ask what the sprint has taught them and what they want to carry forward. Do NOT jump to proposing the next sprint in the opener; let the reflection breathe first.`,
  sprint_needs_review: `The learner's current sprint is past its planned end by 3+ days and hasn't been closed out. Open by acknowledging the sprint is done (not scolding them for not closing it) and asking what they noticed. Be curious about whether the practice stuck, what shifted, what didn't. The next sprint is a later turn, not the opener.`,
  challenge_followup: `The learner had a daily challenge for yesterday (or up to 3 days ago) that's still unmarked. Do NOT chastise them for not marking it. Open with curiosity about how it went. If it didn't happen, be genuinely curious about what got in the way, not judgmental. Offer to save a quick reflection about it.`,
  undebriefed_assessment: `An assessment report has been processed for ≥7 days and the learner hasn't debriefed it yet. Open with a specific pull from the assessment data (in their context) — something that stood out to you. Invite them in rather than reciting the report.`,
  sprint_quiet: `The learner has an active sprint but hasn't logged an action against the goal in 10+ days. Open with warmth, not pressure. Ask what's happening — life, blockers, stuck thinking. Do NOT imply they're failing or that the sprint is broken.`,
  reflection_streak_broken: `The learner had a reflection rhythm going and stopped for a week. Open gently. This is not about getting them back on a streak — it's about checking in on whether something shifted. Be curious, not prescriptive.`,
  new_course_waiting: `A course was assigned to the learner's cohort and they haven't opened it. Don't push. Mention it exists, name something specific about why it might serve them (tied to a goal or pattern in their context), and ask whether they want to open the first lesson together.`,
  course_debrief_pending: `The learner finished a course ≥48h ago but hasn't debriefed it with you yet. Note: this opener is only used as a fallback — the from-nudge page normally hands course_debrief_pending nudges off to startCourseDebrief, which seeds a course-specific opener. If we reach this path, keep it warm: name the course they finished, flag that the learning sticks when connected to something real, and invite them into a short debrief.`,
  momentum_surge: `The learner logged 4+ actions in the last 7 days. Celebrate this — it's rare. Name what you're noticing about the pattern, tie it back to their current sprint if relevant, and ask what's working so they can name it for themselves.`,
  goal_check_in: `The learner has a program-long goal with no active sprint and no action in 45+ days. Do NOT imply it's stalled — these goals run the full program. Open as a soft check-in: how's it sitting, what's showing up, does the goal still feel right. If the conversation moves toward renewed energy, the next move is a sprint — but not in the opener.`,
};

/**
 * Generate a proactive opening message for a thought-partner conversation,
 * grounded in the learner's full context plus pattern-specific guidance.
 * Used when the learner clicks a nudge notification.
 */
export async function generateNudgeOpener(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  pattern: NudgePattern;
  patternData: Record<string, unknown>;
}): Promise<string> {
  const { supabase, userId, pattern, patternData } = args;

  const learnerContext = formatLearnerContext(await assembleLearnerContext(supabase, userId));

  const patternBlock = `## Pattern detected
${PATTERN_GUIDANCE[pattern]}

## Pattern data (computed facts the detector found)
${JSON.stringify(patternData, null, 2)}`;

  const systemPrompt = [
    PERSONA,
    "",
    "## You are opening a proactive message",
    "The learner did not prompt this conversation — you reached out to them based on a pattern you noticed. Your first message should feel like a thoughtful thought partner checking in, not a system notification.",
    "",
    "Rules for this opener:",
    "- 2-4 short sentences. One short paragraph.",
    "- Ground it in specific details from the learner's context — name the goal, the assessment finding, the reflection theme. Generic nudges feel like spam.",
    "- End with ONE question that invites them in, or ONE concrete offer (e.g. 'want to log something quickly' / 'want to open the first lesson together').",
    "- Do not say 'I noticed' more than once.",
    "- Do not apologize for reaching out.",
    "- Do not reference that a 'system' or 'detector' flagged anything — you're a thought partner, not a tool.",
    "",
    patternBlock,
    "",
    "## Learner context (read-only)",
    learnerContext,
  ].join("\n");

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt: "Write the opening message now.",
      maxOutputTokens: 400,
    });
    const text = result.text.trim();
    if (text.length > 0) return text;
  } catch (e) {
    await logAiError({
      feature: "nudge_opener",
      error: e,
      model: MODELS.sonnet,
      userId,
      details: { pattern },
    });
    // fall through to fallback
  }
  return fallbackForPattern(pattern);
}

function fallbackForPattern(pattern: NudgePattern): string {
  switch (pattern) {
    case "sprint_ending_soon":
      return "Your sprint is wrapping up — what has it been teaching you?";
    case "sprint_needs_review":
      return "Your sprint is past its planned end. What did it show you?";
    case "challenge_followup":
      return "How did yesterday's challenge land? Whether it happened or didn't, I'd love to hear.";
    case "undebriefed_assessment":
      return "Your assessment has been sitting with me for a while — want to walk through what stood out?";
    case "sprint_quiet":
      return "You're mid-sprint but it's been quiet — what's going on?";
    case "reflection_streak_broken":
      return "You were journaling regularly and went quiet this week. Anything shifting?";
    case "new_course_waiting":
      return "There's a course waiting on your cohort that might be a good fit — want to open it together?";
    case "course_debrief_pending":
      return "You finished a course a couple of days ago. Worth 10 minutes to debrief what landed before the moment fades?";
    case "momentum_surge":
      return "You're on a real run this week. What's working?";
    case "goal_check_in":
      return "Thinking of your goal — how's it sitting with you lately?";
  }
}
