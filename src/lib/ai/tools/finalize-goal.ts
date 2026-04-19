import { tool } from "ai";
import { z } from "zod";

/**
 * `finalize_goal` — Claude calls this when the thought partner and learner
 * have agreed on a complete, integrative goal. Every goal must articulate
 * impact across all three lenses (self, others, organization) — that's the
 * product point.
 *
 * `primary_lens` is optional metadata about where the learner started
 * thinking, not a silo classification. The thought partner can set it if the
 * learner clearly began from one lens.
 */
export const finalizeGoalInputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Short title of the goal — one sentence, written in the learner's voice."),
  smart_criteria: z
    .object({
      specific: z.string().min(1).describe("Concrete behavior or outcome."),
      measurable: z.string().min(1).describe("How success will be measured."),
      achievable: z.string().min(1).describe("Why this is realistic in the timeframe."),
      relevant: z.string().min(1).describe("Why this matters for the learner's growth."),
      time_bound: z.string().min(1).describe("Deadline or cadence."),
    })
    .describe("One sentence per SMART criterion, in the learner's voice."),
  impact_self: z
    .string()
    .min(10)
    .describe(
      "How achieving this goal changes the learner personally — their habits, mindset, discipline, identity. Required.",
    ),
  impact_others: z
    .string()
    .min(10)
    .describe(
      "How achieving this goal changes the people around the learner — team, peers, direct reports. Required.",
    ),
  impact_org: z
    .string()
    .min(10)
    .describe(
      "How achieving this goal changes the wider organization — culture, execution, strategy, outcomes. Required.",
    ),
  primary_lens: z
    .enum(["self", "others", "org"])
    .optional()
    .describe(
      "Optional: which of the three lenses did the learner start from? This is metadata about the entry point, NOT a classification that confines the goal. Omit if the goal emerged organically across all three.",
    ),
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
      "Save a finalized integrative goal for the learner. Call this only after you and the learner have agreed on the title, all five SMART criteria, AND impact across ALL THREE lenses (self, others, org). Every goal must touch all three — do not call this tool unless all three impacts have real content, not placeholders. The learner will be asked to confirm before the goal is saved.",
    inputSchema: finalizeGoalInputSchema,
    needsApproval: true,
    execute: handler,
  });
}
