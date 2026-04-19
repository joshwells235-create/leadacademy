import { tool } from "ai";
import { z } from "zod";

/**
 * `create_reflection` — Claude calls this when the learner writes a
 * substantive paragraph reflecting on an experience and wants to capture it
 * as a journal entry. Auto-applied: the reflection is saved. Learner can
 * edit or delete from /reflections.
 */
export const createReflectionInputSchema = z.object({
  content: z
    .string()
    .min(20)
    .max(10000)
    .describe(
      "The reflection content, in the learner's voice and words. Do not paraphrase or editorialize — use what they actually said. If they spoke the reflection across multiple messages, combine them coherently. 20+ characters minimum so we don't save throwaway lines.",
    ),
  themes: z
    .array(z.string().min(1).max(50))
    .min(1)
    .max(5)
    .describe(
      "1-5 short lowercase theme tags capturing what this reflection is about. Examples: 'delegation', 'conflict avoidance', 'team trust', 'self-doubt', 'time management'. These accumulate and help surface patterns over time.",
    ),
  reflected_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("ISO date (YYYY-MM-DD) for when the reflected-on event happened. Omit for today."),
});

export type CreateReflectionInput = z.infer<typeof createReflectionInputSchema>;

export function buildCreateReflectionTool(
  handler: (input: CreateReflectionInput) => Promise<{ id: string } | { error: string }>,
) {
  return tool({
    description:
      "Save a journal reflection for the learner when they've written something substantive they should remember. Use this when the learner has spoken (in chat) a paragraph or more of honest self-observation — what an experience taught them, a pattern they noticed in themselves, a tension they're sitting with. Do NOT use for brief comments, logistics, or hypothetical musings. The reflection lands in /reflections immediately.",
    inputSchema: createReflectionInputSchema,
    execute: handler,
  });
}
