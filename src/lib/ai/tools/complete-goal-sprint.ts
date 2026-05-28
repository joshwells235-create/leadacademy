import { tool } from "ai";
import { z } from "zod";

/**
 * `complete_goal_sprint` — close out the active sprint on a goal WITHOUT
 * immediately starting a new one. Use when the learner wants to wrap a
 * sprint: they finished it, they're taking a break, or it ran its course
 * and they're not ready to commit to the next one yet.
 *
 * This is distinct from `start_goal_sprint`, which closes the current
 * sprint as a side effect of starting the next. When the learner IS ready
 * to roll straight into a new sprint, prefer `start_goal_sprint` — it does
 * the close + open in one move. Reach for `complete_goal_sprint` only when
 * the learner is stopping, not transitioning.
 *
 * Approval-gated: ending a sprint is a commitment moment, same as starting
 * one.
 */
export const completeGoalSprintInputSchema = z.object({
  sprint_id: z
    .string()
    .uuid()
    .describe(
      "ID of the active sprint to close. Use only sprint IDs visible in the learner context (the current-sprint block).",
    ),
  outcome: z
    .enum(["completed", "abandoned"])
    .describe(
      "'completed' = the learner ran the sprint and it did its job (whether or not every action landed). 'abandoned' = they're stopping early and it didn't really take. Pick honestly based on what the learner says — most wrap-ups are 'completed'.",
    ),
  reflection: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Optional one-to-two sentence closing reflection in the learner's voice — what the sprint taught them or changed. Shown back in the confirmation pill. Omit if the learner hasn't named anything worth capturing.",
    ),
});

export type CompleteGoalSprintInput = z.infer<typeof completeGoalSprintInputSchema>;

export type CompleteGoalSprintOutput =
  | {
      id: string;
      title: string;
      outcome: "completed" | "abandoned";
      action_count: number;
    }
  | { error: string };

export function buildCompleteGoalSprintTool(
  handler: (input: CompleteGoalSprintInput) => Promise<CompleteGoalSprintOutput>,
) {
  return tool({
    description:
      "Close out the learner's active sprint on a goal WITHOUT starting a new one. Use when the learner is wrapping a sprint and stopping for now — they finished it, want a break, or it ran its course. Do NOT use this when the learner is ready to roll straight into the next sprint — use start_goal_sprint for that (it closes the old one automatically). The learner confirms before the sprint is closed.",
    inputSchema: completeGoalSprintInputSchema,
    needsApproval: true,
    execute: handler,
  });
}
