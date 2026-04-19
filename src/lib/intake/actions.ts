"use server";

import { redirect } from "next/navigation";
import { MODELS } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

/**
 * Start (or resume) the intake conversation. Seeds the thought partner's
 * first message so the learner never lands on a blank canvas — the chat
 * opens with a warm greeting and the first intake question already asked.
 *
 * Mirrors startCapstoneSession / startAssessmentDebrief: creates the
 * conversation server-side, inserts the seeded opener as the first
 * assistant message, and redirects into /coach-chat?c=<id>.
 */
export async function startIntakeSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, intake_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    // No org = can't attach a conversation. Fall back to the chat page.
    redirect("/coach-chat");
  }

  // Resume an in-progress intake if the learner already started one and
  // hasn't finished. Only look at the last 30 days — anything older was
  // effectively abandoned.
  if (!profile?.intake_completed_at) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("mode", "intake")
      .gte("last_message_at", thirtyDaysAgo)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      redirect(`/coach-chat?c=${existing.id}`);
    }
  }

  // New intake conversation.
  const { data: convo, error: convoError } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: membership.org_id,
      user_id: user.id,
      mode: "intake",
      context_ref: { kind: "intake" },
    })
    .select("id")
    .single();
  if (convoError || !convo) {
    redirect("/coach-chat");
  }

  const firstName = profile?.display_name?.trim().split(/\s+/)[0] ?? null;
  const openerText = buildIntakeOpener(firstName);

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

/**
 * The seeded opener. Kept as a deterministic template rather than an LLM
 * call because at this point we know essentially nothing about the learner
 * — the whole point of intake is to gather that. Cheap, fast, consistent.
 */
function buildIntakeOpener(firstName: string | null): string {
  const greeting = firstName
    ? `Hi ${firstName} — I'm your thought partner.`
    : "Hi — I'm your thought partner.";
  return [
    greeting,
    "",
    "Before we get into anything about your leadership work, I'd love to learn a bit about you — your role, your team, your world — so every conversation after this one already feels grounded in who you actually are. It should only take about five minutes.",
    "",
    "Let's start simple: what's your role? The title on your business card, or whatever you'd tell someone at a conference who asked what you do.",
  ].join("\n");
}
