import { tool } from "ai";
import { z } from "zod";

/**
 * `log_coach_note` — coach-partner mode only. The Thought Partner calls
 * this when a substantive observation about a specific coachee surfaces
 * in the conversation that the coach would want to keep as a note on the
 * coachee's record.
 *
 * Auto-applied (no approval pill). The note lands in `coach_notes`
 * immediately; the coach can edit or delete it from
 * /coach/learners/[learner_id]. Notes are private to the coach —
 * the coachee can't see them.
 */
export const logCoachNoteInputSchema = z.object({
  learner_id: z
    .string()
    .uuid()
    .describe(
      "UUID of the coachee this note is about. Must be one of the learner_id values visible in the Coach context — never fabricate. If the coach is talking about their caseload generally without naming a specific coachee, do NOT call this tool.",
    ),
  content: z
    .string()
    .min(5)
    .max(4000)
    .describe(
      "The note itself, 1-5 sentences. Capture the observation in coaching-practice language: a pattern noticed, a decision made, a piece of context the coach wants to carry into the next session. Don't just echo chit-chat.",
    ),
});

export type LogCoachNoteInput = z.infer<typeof logCoachNoteInputSchema>;

export function buildLogCoachNoteTool(
  handler: (
    input: LogCoachNoteInput,
  ) => Promise<{ id: string; learner_name: string | null } | { error: string }>,
) {
  return tool({
    description:
      "Save a private coach note about a specific coachee. Use this when the coach surfaces a substantive observation worth keeping — a pattern, a decision, a piece of session-relevant context. NOT for casual chat. The note is private to the coach; the coachee cannot see it.",
    inputSchema: logCoachNoteInputSchema,
    execute: handler,
  });
}
