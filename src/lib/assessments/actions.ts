"use server";

import { generateText } from "ai";
import { redirect } from "next/navigation";
import { claude, MODELS } from "@/lib/ai/client";
import { assembleLearnerContext } from "@/lib/ai/context/assemble";
import { formatLearnerContext } from "@/lib/ai/context/format";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { ASSESSMENT_MODE } from "@/lib/ai/prompts/modes/assessment";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const OPENER_SYSTEM = `You are the Leadership Academy Thought Partner opening an assessment debrief with a learner. The learner just arrived from /assessments after clicking "Start assessment debrief."

Your first message is PROACTIVE and grounded in their uploaded reports. You have the learner's full context (assessments, combined themes if present, goals, memory facts). Do not open with "Hi, how can I help" — that's a waste of their time.

Your opener should:
- Be 2-4 short sentences. One short paragraph. No greeting preamble like "Hi, I see..."
- Name 1-2 specific things that stood out when you read the reports side by side. If integrated themes are present in context, draw from those — that's the synthesis that's hardest for the learner to see on their own.
- Use tendency language for PI findings ("tends toward...", "can lean toward..."). Use direct language for EQ-i and 360 where appropriate.
- End with ONE question that invites them in — either "does that ring true?" or "where would you like to start?" style. Pick whichever fits the observation better.
- Never fabricate findings. Only reference what's in their context.
- Don't list everything. Pick the most interesting thread.

Output ONLY the opener text. No preamble, no sign-off, no formatting.`;

/**
 * Start an assessment debrief conversation. Creates the conversation row,
 * generates a proactive opening assistant message grounded in the learner's
 * uploaded reports, and redirects into /coach-chat?c=<id>.
 */
export async function startAssessmentDebrief() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  // Confirm at least one ready assessment exists before bothering.
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!assessment) redirect("/assessments");

  const { data: readyDocs } = await supabase
    .from("assessment_documents")
    .select("id")
    .eq("assessment_id", assessment.id)
    .eq("status", "ready")
    .limit(1);
  if (!readyDocs || readyDocs.length === 0) redirect("/assessments");

  const { data: convo, error: convoError } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: membership.org_id,
      user_id: user.id,
      mode: "assessment",
      context_ref: {},
    })
    .select("id")
    .single();
  if (convoError || !convo) redirect("/assessments");

  // Build the same context + system prompt the in-chat coach will see, so
  // the opener is grounded in everything the coach knows.
  const learnerContext = formatLearnerContext(await assembleLearnerContext(supabase, user.id));
  const systemPrompt = [
    PERSONA,
    `\n## Current mode\n${ASSESSMENT_MODE}`,
    `\n## Learner context (read-only, updated each turn)\n${learnerContext}`,
    `\n## Opener task\n${OPENER_SYSTEM}`,
  ].join("\n");

  let openerText: string;
  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt:
        "Write the opening message for the assessment debrief now. Ground it in the context above.",
      maxOutputTokens: 400,
    });
    openerText = result.text.trim();
  } catch {
    // Generic fallback if synthesis fails — still proactive, still better than blank.
    openerText =
      "I've read through your uploaded assessments. A few things stood out when I read them side by side — want me to walk you through what I noticed, or is there a specific report you'd like to start with?";
  }

  if (!openerText) {
    openerText =
      "I've read through your uploaded assessments. A few things stood out when I read them side by side — want me to walk you through what I noticed, or is there a specific report you'd like to start with?";
  }

  const assistantContent = {
    id: crypto.randomUUID(),
    role: "assistant" as const,
    parts: [{ type: "text", text: openerText }],
  };

  await supabase.from("ai_messages").insert({
    conversation_id: convo.id,
    role: "assistant",
    content: assistantContent as unknown as Json,
    model: MODELS.sonnet,
  });

  await supabase
    .from("ai_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", convo.id);

  redirect(`/coach-chat?c=${convo.id}`);
}
