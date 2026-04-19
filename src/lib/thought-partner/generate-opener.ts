import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { assembleLearnerContext } from "@/lib/ai/context/assemble";
import { formatLearnerContext } from "@/lib/ai/context/format";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { GENERAL_MODE } from "@/lib/ai/prompts/modes/general";
import { GOAL_MODE } from "@/lib/ai/prompts/modes/goal";
import { REFLECTION_MODE } from "@/lib/ai/prompts/modes/reflection";
import type { Database } from "@/lib/types/database";

export type OpenerMode = "general" | "goal" | "reflection";
export type OpenerLens = "self" | "others" | "org";

type GenerateArgs = {
  supabase: SupabaseClient<Database>;
  userId: string;
  mode: OpenerMode;
  lens?: OpenerLens;
};

export async function generateThoughtPartnerOpener(args: GenerateArgs): Promise<string> {
  const { supabase, userId, mode, lens } = args;

  const ctx = await assembleLearnerContext(supabase, userId);
  const firstName = ctx.identity.name?.trim().split(/\s+/)[0] ?? null;
  const hasArtifacts =
    ctx.goals.length > 0 ||
    ctx.recentActions.length > 0 ||
    ctx.reflections.length > 0 ||
    Object.keys(ctx.assessments ?? {}).length > 0;

  // Brand-new learner, plain-general mode: use a deterministic warm opener so
  // we don't burn an LLM call on what is essentially "hello, what's on your
  // mind?" with no data to ground anything in. LLM-generated greetings with
  // nothing to reference tend to sound hollow anyway.
  if (mode === "general" && !hasArtifacts) {
    return buildGeneralWarmOpener(firstName);
  }

  const learnerContext = formatLearnerContext(ctx);
  const modeBlock =
    mode === "goal" ? GOAL_MODE : mode === "reflection" ? REFLECTION_MODE : GENERAL_MODE;

  const openerTask = openerTaskFor(mode, lens);

  const systemPrompt = [
    PERSONA,
    "",
    "## Current mode",
    modeBlock,
    "",
    "## You are writing the OPENING message of this conversation",
    openerTask,
    "",
    "## Learner context (read-only)",
    learnerContext,
  ].join("\n");

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt: "Write the opening message now. No preamble, no sign-off.",
      maxOutputTokens: 500,
    });
    const text = result.text.trim();
    if (text.length > 0) return text;
  } catch {
    // fall through to deterministic fallback
  }
  return fallbackFor(mode, firstName);
}

function openerTaskFor(mode: OpenerMode, lens: OpenerLens | undefined): string {
  if (mode === "goal") {
    const lensHint = lens
      ? `The learner arrived from the **${lensLabel(lens)}** lens — that's their on-ramp. Name it briefly and make clear the goal still has to land across all three lenses.`
      : "The learner hasn't picked a starting lens. That's fine — let them start wherever feels real.";
    return [
      "The learner just clicked 'Draft a goal.' They haven't prompted you yet — they're waiting to see where you start.",
      "",
      "Your opener:",
      "- One short warm sentence that names you're here to help them draft an integrative goal (one that changes them, their team, and their organization).",
      lensHint,
      "- If their context already shows goals they've been circling (active goals with recent actions, or reflection themes that point somewhere), name ONE as a possible starting point — in their own words, not generic framing.",
      "- End with ONE question that invites them to name what they want to work on. Don't list three options.",
      "- Keep the whole message under 100 words. Plain language. No bullet points in the message itself.",
      "- Don't call any tools. This is a conversation starter.",
    ].join("\n");
  }

  if (mode === "reflection") {
    return [
      "The learner just clicked 'Reflect with your thought partner.' They haven't written anything yet — they're deciding where to start.",
      "",
      "Your opener:",
      "- One short warm sentence that invites reflection without pressure.",
      "- If their context shows a recent goal, action, or theme that seems worth touching, name it as a possible starting point — in their words. If context is thin, don't invent something; just open the door.",
      "- End with ONE open question that makes it easy to start typing. Avoid 'how did that make you feel.'",
      "- Keep the whole message under 80 words. Plain language. No bullet points.",
      "- Don't call any tools. This is a conversation starter.",
    ].join("\n");
  }

  // general with artifacts
  return [
    "The learner just opened a new conversation with you. They haven't said anything yet.",
    "",
    "Your opener:",
    "- One or two short sentences, warm and specific. Reference ONE thing from their context that's genuinely recent or unresolved (an active sprint, a reflection theme, an open action item, a recently-completed goal) — in their own words.",
    "- End with ONE open question that makes it easy for them to pick up where they left off — OR to pivot if that's not what's on their mind.",
    "- Keep the whole message under 60 words. Plain language.",
    "- Don't call any tools. This is a conversation starter.",
    "- Don't list multiple options. Pick the thread that looks most alive and invite them in.",
  ].join("\n");
}

function lensLabel(lens: OpenerLens): string {
  if (lens === "self") return "Leading Self";
  if (lens === "others") return "Leading Others";
  return "Leading the Organization";
}

function buildGeneralWarmOpener(firstName: string | null): string {
  const greeting = firstName ? `Hi ${firstName} — ` : "Hi — ";
  return `${greeting}I'm your thought partner. I'm here whenever something comes up as a leader and you want to think out loud. What's on your mind?`;
}

function fallbackFor(mode: OpenerMode, firstName: string | null): string {
  const greeting = firstName ? `Hi ${firstName} — ` : "";
  if (mode === "goal") {
    return `${greeting}let's draft a goal you can actually feel. A real leadership goal changes you, the people around you, and the organization. What are you trying to grow into?`;
  }
  if (mode === "reflection") {
    return `${greeting}what's been on your mind as a leader this week? Start anywhere — a moment that stuck with you, a tension you haven't resolved, a small win.`;
  }
  return `${greeting}what would be useful to think through together right now?`;
}
