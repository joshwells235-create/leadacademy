import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";

const SYSTEM_PROMPT = `You name thought-partner conversations with a short, specific label.

Rules:
- 2-6 words, Title Case, no trailing punctuation.
- Capture the core subject (e.g. "Delegation with New Manager", "Reading a 360 Report", "Stalled Promotion Goal").
- Avoid filler words like "About", "Discussion", "Conversation", "Chat".
- Never quote the learner directly.
- If the exchange is too thin to classify, return "Untitled".

Respond with ONLY the title text. No preamble, no quotes, no trailing period.`;

/**
 * Generate a short sidebar title for a conversation from its opening exchange.
 * Fire-and-forget from the chat route — any failure is swallowed silently so
 * a slow/broken Haiku call never blocks the user's next turn.
 */
export async function generateConversationTitle(args: {
  userMessage: string;
  assistantMessage: string;
}): Promise<string | null> {
  const prompt = `Learner said:
${args.userMessage.slice(0, 2000)}

Thought partner replied:
${args.assistantMessage.slice(0, 2000)}

Generate the title.`;

  try {
    const { text } = await generateText({
      model: claude(MODELS.haiku),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 32,
    });
    const cleaned = text
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/[.!?]+$/g, "")
      .trim();
    if (cleaned.length === 0 || cleaned.toLowerCase() === "untitled") return null;
    return cleaned.slice(0, 80);
  } catch {
    return null;
  }
}
