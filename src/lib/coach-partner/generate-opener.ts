import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { buildCoachContext } from "@/lib/ai/context/build-coach-context";
import { COACH_PARTNER_PROMPT } from "@/lib/ai/prompts/modes/coach-partner";
import type { Database } from "@/lib/types/database";

type GenerateArgs = {
  supabase: SupabaseClient<Database>;
  coachUserId: string;
  /** Optional — scopes the opener to a single coachee (session prep / deep-dive). */
  learnerUserId?: string;
  /**
   * Optional — framing kind for the opener. `weekly_review` produces a
   * Sunday-thinking three-beat prompt (what happened · what's underserved
   * · what's the plan) rather than the default caseload-scan opener.
   */
  kind?: "weekly_review";
};

/**
 * Generates the opening assistant message for a coach-partner conversation.
 * Two shapes:
 *
 * - learner-scoped: "You have Maria in 30 minutes. The live thread is her
 *   delegation sprint — she logged three actions last week but the recap
 *   still mentions the same softening-under-pressure pattern. Want to
 *   start there?"
 *
 * - caseload-level: a short scan of the whole caseload, surfacing what
 *   looks most alive this week, with one invitation to dig in.
 */
export async function generateCoachPartnerOpener(args: GenerateArgs): Promise<string> {
  const { supabase, coachUserId, learnerUserId, kind } = args;

  const coachContext = await buildCoachContext({ supabase, coachUserId, learnerUserId });

  const openerTask =
    kind === "weekly_review"
      ? [
          "You're opening a WEEKLY REVIEW conversation with the coach — a Sunday-thinking ritual where they step back from individual sessions to think about the week's shape across their whole caseload.",
          "",
          "Your opener:",
          "- Frame the three beats they'll work through, briefly: (1) what happened across the caseload this week, (2) who or what's been underserved, (3) what matters most for the week ahead.",
          "- Name ONE specific thread from the Coach context that's a useful starting place (a shared pattern, a coachee who had a breakthrough, a sprint that wrapped, a quiet week overall — whatever is actually loud).",
          "- End with ONE open question that invites beat one (what happened) — but let the coach steer.",
          "- Keep the whole message under 110 words. No bullet points in the message itself.",
          "- Don't call any tools. This is a conversation starter.",
        ].join("\n")
      : learnerUserId
        ? [
            "You're about to open a prep conversation with the coach about a specific coachee (see the deep-dive in the Coach context below).",
            "",
            "Your opener:",
            "- One or two short sentences that surface ONE specific, recent, live thread for this coachee — in the coachee's words where possible (e.g., a reflection theme, an active-sprint practice, a line from the last recap).",
            "- End with ONE open question the coach can use as a thinking prompt for prep.",
            "- Keep the whole message under 80 words. No bullet points in the message itself.",
            "- Don't summarize everything you see. Pick the thread that looks most alive and invite the coach in.",
            "- Don't call any tools. This is a conversation starter.",
          ].join("\n")
        : [
            "You're about to open a caseload-level conversation with the coach — no specific coachee is selected.",
            "",
            "Your opener:",
            "- One or two short sentences that name the most interesting cross-caseload signal from the Coach context (a shared pattern across two or more coachees, one coachee who looks most in need of attention this week, a coachee who just had a breakthrough — whatever is actually loud in the data).",
            "- End with ONE open question that invites the coach to pick up the thread, pivot to a specific coachee, or surface something else entirely.",
            "- Keep the whole message under 80 words. No bullet points in the message itself.",
            "- Be specific. Use coachee names. If the caseload is thin or just starting, say so warmly — don't invent signal.",
            "- Don't call any tools. This is a conversation starter.",
          ].join("\n");

  const systemPrompt = [
    COACH_PARTNER_PROMPT,
    "",
    "## You are writing the OPENING message of this conversation",
    openerTask,
    "",
    "## Coach context (read-only)",
    coachContext,
  ].join("\n");

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt: "Write the opening message now. No preamble, no sign-off.",
      maxOutputTokens: 400,
    });
    const text = result.text.trim();
    if (text.length > 0) return text;
  } catch {
    // fall through
  }
  if (kind === "weekly_review") {
    return "Let's do the weekly review in three beats: what happened across your caseload this week, who or what's been underserved, and what matters most for the week ahead. Start wherever — what's sitting with you most right now?";
  }
  return learnerUserId
    ? "Happy to think through this coachee with you. Where would be useful to start — the last session, something recent that's been on your mind, or a specific moment you're anticipating?"
    : "What's alive across your caseload this week? A coachee you're stuck on, a pattern you're noticing, or a session you want to prep for — start anywhere.";
}
