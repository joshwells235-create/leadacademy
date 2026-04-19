import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { assembleLearnerContext } from "@/lib/ai/context/assemble";
import { formatLearnerContext } from "@/lib/ai/context/format";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { CAPSTONE_MODE } from "@/lib/ai/prompts/modes/capstone";
import type { Database } from "@/lib/types/database";

/**
 * Generates the opening message for a capstone conversation — a first-pass
 * story-arc draft grounded in the learner's full 9-month data (goals,
 * sprints, reflections, action logs, assessment findings). The learner
 * reacts and the thought partner refines one section at a time via refine_capstone_section.
 *
 * This is NOT the final outline; it's the starting point the conversation
 * shapes. We lean on Sonnet because capstone synthesis wants depth and
 * nuance over speed.
 */
export async function generateCapstoneOpener(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<string> {
  const { supabase, userId } = args;

  const learnerContext = formatLearnerContext(await assembleLearnerContext(supabase, userId));

  const systemPrompt = [
    PERSONA,
    "",
    "## Current mode",
    CAPSTONE_MODE,
    "",
    "## You are opening a capstone conversation",
    "The learner just clicked 'Generate Story Outline' on their capstone page. This is the first message of the conversation. They have NOT prompted you with a question — they're waiting to see what you see in their 9 months of data.",
    "",
    "In this opener:",
    "1. Acknowledge, in one sentence, that you've been looking across their journey.",
    "2. Offer a FIRST-DRAFT shape of the story — the Before → Catalyst → Shift → Evidence → What's Next arc. Keep each beat to 2-3 sentences MAX. Ground each beat in specifics from their data: real goals by title, real sprints by practice, real reflection themes, real assessment findings. Use their own phrasing wherever you can.",
    "3. Close by inviting them to react to one beat at a time — name which beat you think needs the most attention first (usually the one the data supports least clearly) and ask them to start there.",
    "",
    "Rules:",
    "- Do NOT call refine_capstone_section in the opener. This is a draft to react to, not a finalized section.",
    "- Do NOT invent specifics. If their data is thin somewhere, name that honestly and ask them what they'd add.",
    "- Do NOT use leadership-book jargon. Their words beat generic language every time.",
    "- Keep the whole message under ~350 words. This is a conversation starter, not the presentation.",
    "",
    "## Learner context (read-only)",
    learnerContext,
  ].join("\n");

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt: "Write the opening capstone-story draft now.",
      maxOutputTokens: 1500,
    });
    const text = result.text.trim();
    if (text.length > 0) return text;
  } catch {
    // fall through
  }
  return "Let's shape your capstone story together. Start anywhere — who were you as a leader walking into this program, and who do you feel like now? We'll work the rest from there.";
}
