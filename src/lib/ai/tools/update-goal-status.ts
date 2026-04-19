import { tool } from "ai";
import { z } from "zod";

/**
 * `update_goal_status` — Claude proposes a status change (complete, pause,
 * abandon) when the learner signals they're there. Requires approval before
 * the status actually changes — closing a goal is a commitment moment, not
 * a surprise.
 */
export const updateGoalStatusInputSchema = z.object({
  goal_id: z
    .string()
    .uuid()
    .describe("ID of the goal to update. Use only IDs visible in the learner context."),
  status: z
    .enum(["completed", "archived", "in_progress"])
    .describe(
      "New status. 'completed' = learner achieved it. 'archived' = learner is setting it aside (paused, deprioritized, or abandoned). 'in_progress' = reopening a previously completed/archived goal.",
    ),
  rationale: z
    .string()
    .min(10)
    .max(500)
    .describe(
      "One short sentence in the learner's voice summarizing WHY this change. Shown back to them in the confirmation pill so the decision is visible, not silent.",
    ),
});

export type UpdateGoalStatusInput = z.infer<typeof updateGoalStatusInputSchema>;

export function buildUpdateGoalStatusTool(
  handler: (
    input: UpdateGoalStatusInput,
  ) => Promise<{ id: string; title: string; status: string } | { error: string }>,
) {
  return tool({
    description:
      "Propose a status change on one of the learner's goals (complete, archive, or reopen). Use this when the learner clearly signals the goal has been achieved, is no longer right, or needs to come back off the shelf. The learner will be asked to confirm before the change is saved — name the rationale clearly so they can read it back.",
    inputSchema: updateGoalStatusInputSchema,
    needsApproval: true,
    execute: handler,
  });
}
