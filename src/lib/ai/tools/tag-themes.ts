import { tool } from "ai";
import { z } from "zod";

/**
 * `tag_themes` — Claude calls this after responding to a reflection to tag
 * 1-5 short theme labels that capture what the reflection was about.
 * Themes accumulate over time; the coach uses them to spot patterns.
 */
export const tagThemesInputSchema = z.object({
  reflectionId: z.string().uuid().describe("The ID of the reflection to tag."),
  themes: z
    .array(z.string().min(1).max(50))
    .min(1)
    .max(5)
    .describe(
      "1-5 short theme tags that capture what this reflection was about. Use lowercase, 1-3 words each. Examples: 'delegation', 'conflict avoidance', 'team trust', 'time management', 'self-doubt'.",
    ),
});

export type TagThemesInput = z.infer<typeof tagThemesInputSchema>;

export function buildTagThemesTool(
  handler: (input: TagThemesInput) => Promise<{ ok: boolean } | { error: string }>,
) {
  return tool({
    description:
      "Tag a reflection with 1-5 short theme labels. Call this after responding to a reflection entry to help surface patterns over time.",
    inputSchema: tagThemesInputSchema,
    execute: handler,
  });
}
