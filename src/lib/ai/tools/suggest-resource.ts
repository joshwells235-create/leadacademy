import { tool } from "ai";
import { z } from "zod";

export type ResourceSearchHit = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: string;
  url: string;
};

/**
 * `suggest_resource` — Claude calls this when the conversation surfaces a
 * topic where an external article, template, or video in the resource
 * library would help. Read-only: returns up to 3 hits. Rendered as cards.
 *
 * Unlike lessons, resources are globally available (no cohort scoping).
 */
export const suggestResourceInputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(120)
    .describe(
      "A short topic phrase to search for. Keep it to 1-4 words matching the concept at hand, not a full question. Examples: 'feedback templates', 'stakeholder mapping', 'burnout'.",
    ),
});

export type SuggestResourceInput = z.infer<typeof suggestResourceInputSchema>;

export type SuggestResourceOutput = { resources: ResourceSearchHit[] } | { error: string };

export function buildSuggestResourceTool(
  handler: (input: SuggestResourceInput) => Promise<SuggestResourceOutput>,
) {
  return tool({
    description:
      "Search the resource library for articles, templates, or videos matching a topic and surface them as cards. Use this when an external reference would genuinely help, not as a lazy closer. If no good match is found, acknowledge it and move on — never invent resources.",
    inputSchema: suggestResourceInputSchema,
    execute: handler,
  });
}
