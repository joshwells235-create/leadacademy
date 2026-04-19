import { tool } from "ai";
import { z } from "zod";
import type { LessonSearchHit } from "./search-lessons";

/**
 * `suggest_lesson` — Claude calls this when the conversation surfaces a
 * topic that maps to a lesson in the learner's assigned courses. Read-only:
 * returns a ranked list of lesson hits (best match first). The client
 * renders them as cards with a link to the lesson.
 */
export const suggestLessonInputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(120)
    .describe(
      "A short topic phrase to search for, 1-4 words. Examples: 'delegation', 'giving feedback', 'running a 1:1', 'managing up'. Use the concept the learner is actually wrestling with, not a paraphrase.",
    ),
});

export type SuggestLessonInput = z.infer<typeof suggestLessonInputSchema>;

export type SuggestLessonOutput = { lessons: LessonSearchHit[] } | { error: string };

export function buildSuggestLessonTool(
  handler: (input: SuggestLessonInput) => Promise<SuggestLessonOutput>,
) {
  return tool({
    description:
      "Search the learner's assigned courses for lessons matching a topic, and surface the top matches as clickable cards in the chat. Use this when the conversation uncovers a concept the learner could go deeper on — don't just tell them to 'check the library'. Only searches courses that have been assigned to their cohort. Returns up to 3 hits, ranked by match strength. If nothing matches, acknowledge it and move on — do not invent lessons.",
    inputSchema: suggestLessonInputSchema,
    execute: handler,
  });
}
