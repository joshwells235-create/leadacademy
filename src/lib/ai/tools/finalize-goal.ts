import { tool } from "ai";
import { z } from "zod";

/**
 * `finalize_goal` — Claude calls this when learner + coach have agreed on a
 * complete SMART goal. The handler runs on our server with the learner's
 * Supabase session, so RLS enforces that the row is theirs.
 */
export const finalizeGoalInputSchema = z.object({
  tier: z.enum(["self", "others", "org"]).describe(
    "Which of the three tiers this goal belongs to: Leading Self, Leading Others, or Leading the Organization.",
  ),
  title: z.string().min(1).max(200).describe(
    "Short title of the goal — one sentence, written in the learner's voice.",
  ),
  smart_criteria: z
    .object({
      specific: z.string().min(1).describe("Concrete behavior or outcome."),
      measurable: z.string().min(1).describe("How success will be measured."),
      achievable: z.string().min(1).describe("Why this is realistic in the timeframe."),
      relevant: z.string().min(1).describe("Why this matters for the learner's growth."),
      time_bound: z.string().min(1).describe("Deadline or cadence."),
    })
    .describe("One sentence per SMART criterion, in the learner's voice."),
  impact_self: z.string().optional().describe("How achieving this changes the learner. Optional if self tier."),
  impact_others: z.string().optional().describe("How it affects their team or peers."),
  impact_org: z.string().optional().describe("How it affects the wider organization."),
  target_date: z
    .string()
    .optional()
    .describe("ISO date (YYYY-MM-DD) if discussed. Omit if only approximate timing was mentioned."),
});

export type FinalizeGoalInput = z.infer<typeof finalizeGoalInputSchema>;

export function buildFinalizeGoalTool(
  handler: (input: FinalizeGoalInput) => Promise<{ id: string; title: string } | { error: string }>,
) {
  return tool({
    description:
      "Save a finalized SMART goal for the learner. Call this only after the coach and learner have agreed on all five SMART criteria, the tier, at least one impact field, and a target timeframe.",
    inputSchema: finalizeGoalInputSchema,
    execute: handler,
  });
}
