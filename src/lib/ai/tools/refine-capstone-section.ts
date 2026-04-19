import { tool } from "ai";
import { z } from "zod";

/**
 * `refine_capstone_section` — the thought partner proposes an updated version of one
 * section of the learner's capstone outline. The learner approves before the
 * outline row is updated. Not for draft-level content; only call when the
 * section's shape is clear enough to be worth saving.
 *
 * The outline is structured as five beats — Before / Catalyst / Shift /
 * Evidence / What's Next. A capstone conversation typically refines them
 * one at a time; calling this tool with multiple sections at once is an
 * anti-pattern.
 */
export const CAPSTONE_SECTION_KINDS = [
  "before",
  "catalyst",
  "shift",
  "evidence",
  "what_next",
] as const;

export type CapstoneSectionKind = (typeof CAPSTONE_SECTION_KINDS)[number];

export const refineCapstoneSectionInputSchema = z.object({
  kind: z
    .enum(CAPSTONE_SECTION_KINDS)
    .describe(
      "Which section of the outline this refinement updates. Before = who they were walking in. Catalyst = what cracked open. Shift = how their thinking / stance changed. Evidence = where the shift showed up in real action. What_next = what they carry forward after the program.",
    ),
  heading: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "Short heading for this section in the learner's voice — not a generic label. Example: 'Before: the fixer who couldn't let a meeting end messy'.",
    ),
  body: z
    .string()
    .min(40)
    .max(2000)
    .describe(
      "The section's narrative paragraph(s), written in the learner's voice and grounded in specifics from their actual data. 1-3 paragraphs. Use their own phrasing where possible. Not bullet points.",
    ),
  moments: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
      }),
    )
    .max(5)
    .optional()
    .describe(
      "Up to 5 specific supporting moments for this section — a logged action, a sprint milestone, a conversation that shifted them, a named reaction from a direct report. Each should reference real evidence from their data, not invented scenes. Omit for sections where narrative alone carries it.",
    ),
  pull_quotes: z
    .array(
      z.object({
        text: z.string().min(1).max(300),
        source: z
          .string()
          .min(1)
          .max(120)
          .describe(
            "Where this line came from in the learner's own data — e.g. 'reflection, 2026-04-02' or 'action log, Q1 sprint'.",
          ),
      }),
    )
    .max(3)
    .optional()
    .describe(
      "Up to 3 quotable lines drawn from the learner's OWN reflections or action-log entries — verbatim, attributed. Do not invent or paraphrase quotes. Omit if no strong candidates exist.",
    ),
});

export type RefineCapstoneSectionInput = z.infer<typeof refineCapstoneSectionInputSchema>;

export type RefineCapstoneSectionOutput =
  | { ok: true; kind: CapstoneSectionKind; heading: string }
  | { error: string };

export function buildRefineCapstoneSectionTool(
  handler: (input: RefineCapstoneSectionInput) => Promise<RefineCapstoneSectionOutput>,
) {
  return tool({
    description:
      "Save a refined version of one section of the learner's capstone outline (Before / Catalyst / Shift / Evidence / What's Next). Call this only when the section's shape has landed in the conversation — not for first drafts. Only one section per call. Every section should ground in real evidence from the learner's data; do not invent moments or quotes. The learner confirms before the section is saved.",
    inputSchema: refineCapstoneSectionInputSchema,
    needsApproval: true,
    execute: handler,
  });
}
