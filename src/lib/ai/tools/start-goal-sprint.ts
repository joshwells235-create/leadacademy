import { tool } from "ai";
import { z } from "zod";

/**
 * `start_goal_sprint` — Claude proposes a concrete practice window on one
 * of the learner's goals. If the goal already has an active sprint, it
 * gets closed and this one starts. A sprint is the translation layer
 * between a program-long behavioral goal and something the learner can
 * practice over the next several weeks — with a visible action count as
 * the feedback loop.
 *
 * Approval-gated: starting (or transitioning) a sprint is a commitment
 * moment, not a background write.
 */
export const startGoalSprintInputSchema = z.object({
  goal_id: z
    .string()
    .uuid()
    .describe(
      "ID of the goal this sprint belongs to. Use only IDs visible in the learner context.",
    ),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "A short chapter-style title for the sprint, in the learner's voice. Not the goal — the specific chapter. Examples: 'Naming the fear of letting go', 'Making the hand-off stick', 'Practicing the harder conversations'.",
    ),
  practice: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One sentence naming the SPECIFIC behavior the learner will practice across this sprint. Must be verb-first and concrete enough that they could notice themselves doing or not doing it. Examples: 'Resist rewriting direct reports' drafts before they ship', 'Open every 1:1 with the one hard question I'm tempted to skip', 'Ask before answering in exec meetings'. Do NOT accept vague practices like 'be more present' or 'delegate better'.",
    ),
  planned_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      "ISO date (YYYY-MM-DD) when the sprint wraps. Typical sprints run 4-8 weeks. Shorter is fine for a focused burst; longer risks losing the feedback loop.",
    ),
});

export type StartGoalSprintInput = z.infer<typeof startGoalSprintInputSchema>;

export type StartGoalSprintOutput =
  | {
      id: string;
      title: string;
      practice: string;
      planned_end_date: string;
      sprint_number: number;
    }
  | { error: string };

export function buildStartGoalSprintTool(
  handler: (input: StartGoalSprintInput) => Promise<StartGoalSprintOutput>,
) {
  return tool({
    description:
      "Propose starting a new sprint on one of the learner's goals. Use when the learner names a concrete behavior to practice over a specific near-term window. If the goal already has an active sprint, this closes it automatically — the transition is meant to happen inside the conversation where the coach and learner reflect on what the last sprint taught them and what's next. The learner confirms before the sprint is saved. Do NOT use this for the goal itself (that's finalize_goal). Do NOT use with a vague practice — if the learner hasn't named a specific behavior, keep asking first.",
    inputSchema: startGoalSprintInputSchema,
    needsApproval: true,
    execute: handler,
  });
}
