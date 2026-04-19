import { tool } from "ai";
import { z } from "zod";

/**
 * `log_action` — Claude calls this when the learner describes something they
 * did (or are about to do today) that advances a goal. Auto-applied: the row
 * lands in the action log immediately. The learner can edit or delete it
 * from /action-log.
 */
export const logActionInputSchema = z.object({
  description: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      "What the learner did, in their own voice, 1-3 sentences. Don't editorialize. If they said 'I finally held the line on the deadline with my PM today', that's the description verbatim-ish.",
    ),
  goal_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "ID of the goal this action advances. Use only goal IDs visible in the learner context. Omit if the action doesn't clearly map to a specific goal.",
    ),
  impact_area: z
    .enum(["self", "others", "org", "all"])
    .optional()
    .describe(
      "Which lens this action primarily touched. 'all' when the action clearly spanned all three.",
    ),
  reflection: z
    .string()
    .max(5000)
    .optional()
    .describe(
      "Short reflection the learner offered about the action — what they noticed, what was hard, what went well. Omit if they didn't reflect.",
    ),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "ISO date (YYYY-MM-DD) when the action occurred. Omit for today; only set if the learner mentions a specific past date.",
    ),
});

export type LogActionInput = z.infer<typeof logActionInputSchema>;

export function buildLogActionTool(
  handler: (input: LogActionInput) => Promise<{ id: string } | { error: string }>,
) {
  return tool({
    description:
      "Log an action the learner took (or is committing to take today) against a specific goal. Use this when the learner describes behavior — what they did, what they tried, what they're about to do. Do not use for hypotheticals or goals themselves. The action lands in /action-log immediately.",
    inputSchema: logActionInputSchema,
    execute: handler,
  });
}
