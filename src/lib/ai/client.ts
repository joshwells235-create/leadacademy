import { anthropic, createAnthropic } from "@ai-sdk/anthropic";

/**
 * Anthropic provider. Uses ANTHROPIC_API_KEY from env by default; this factory
 * exists so we can inject a different key per-org later (BYO-key).
 */
export const claude = anthropic;

export function createClaude(apiKey?: string) {
  if (!apiKey) return anthropic;
  return createAnthropic({ apiKey });
}

export const MODELS = {
  // Default for chat, streaming, most coaching interactions.
  sonnet: "claude-sonnet-4-6",
  // Reserved for heavy synthesis (assessment parsing, capstone outlining, session recaps).
  opus: "claude-opus-4-6",
  // Cheap/fast utility: conversation titling, classification, short labels.
  haiku: "claude-haiku-4-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
