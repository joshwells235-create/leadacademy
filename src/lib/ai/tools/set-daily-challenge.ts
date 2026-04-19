import { tool } from "ai";
import { z } from "zod";

/**
 * `set_daily_challenge` — Claude proposes a concrete, 1-day challenge the
 * learner will try today or tomorrow. Requires approval because it writes
 * (or overwrites) the learner's daily challenge. The `for_date` is
 * mandatory so the thought partner must be explicit about today vs tomorrow.
 *
 * Table has a UNIQUE(user_id, for_date) constraint. The handler detects
 * collisions and either returns the existing row (so the thought partner can ask
 * "replace your current one?") or upserts based on `replace_existing`.
 */
export const setDailyChallengeInputSchema = z.object({
  challenge: z
    .string()
    .min(10)
    .max(2000)
    .describe(
      "The challenge, 1-3 sentences, actionable in a single day. Must be specific and behavioral ('in your next meeting, let someone finish their thought before responding'), never vague ('be a better listener').",
    ),
  for_date: z
    .enum(["today", "tomorrow"])
    .describe(
      "When the challenge is for. 'today' if the learner wants to act before end of day, 'tomorrow' if they want to prepare. If the learner is vague, prefer tomorrow — giving them a night to sit with it lands better than a rushed hour.",
    ),
  replace_existing: z
    .boolean()
    .default(false)
    .describe(
      "Set true ONLY after the learner has been told there's already a challenge for that date and explicitly agreed to replace it. Leave false on the first call — the tool will detect a collision and return information for you to reason about.",
    ),
});

export type SetDailyChallengeInput = z.infer<typeof setDailyChallengeInputSchema>;

export type SetDailyChallengeOutput =
  | { id: string; challenge: string; for_date: string; replaced: boolean }
  | { collision: true; existing_challenge: string; for_date: string }
  | { error: string };

export function buildSetDailyChallengeTool(
  handler: (input: SetDailyChallengeInput) => Promise<SetDailyChallengeOutput>,
) {
  return tool({
    description:
      "Set the learner's daily challenge for today or tomorrow. Use when the learner commits to trying something specific in the next day — a concrete behavior they can practice. The learner will be asked to confirm before it's saved. If a challenge already exists for the target date and you haven't set replace_existing=true, the tool returns collision info so you can ask the learner whether to replace it.",
    inputSchema: setDailyChallengeInputSchema,
    needsApproval: true,
    execute: handler,
  });
}
