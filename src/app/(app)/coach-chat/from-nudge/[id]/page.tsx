import { redirect } from "next/navigation";
import { MODELS } from "@/lib/ai/client";
import { generateNudgeOpener } from "@/lib/ai/nudges/generate-opener";
import { NUDGE_PATTERNS, type NudgePattern } from "@/lib/ai/nudges/types";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

type Props = { params: Promise<{ id: string }> };

/**
 * Landing for a clicked proactive nudge notification.
 * - Loads the nudge
 * - Generates a rich opener grounded in the pattern + full learner context
 * - Creates a new coach-chat conversation with the opener seeded
 * - Marks the nudge acted + notification read
 * - Redirects into /coach-chat?c=<new-conversation-id>
 *
 * If the nudge is already acted-on, redirects straight to /coach-chat
 * without creating a new conversation.
 */
export default async function FromNudgePage({ params }: Props) {
  const { id: nudgeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: nudge } = await supabase
    .from("coach_nudges")
    .select("id, org_id, user_id, pattern, pattern_data, notification_id, acted_at")
    .eq("id", nudgeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!nudge) redirect("/dashboard");

  if (nudge.acted_at) {
    redirect("/coach-chat");
  }

  const pattern = (NUDGE_PATTERNS as readonly string[]).includes(nudge.pattern)
    ? (nudge.pattern as NudgePattern)
    : null;
  if (!pattern) redirect("/dashboard");

  const patternData =
    nudge.pattern_data &&
    typeof nudge.pattern_data === "object" &&
    !Array.isArray(nudge.pattern_data)
      ? (nudge.pattern_data as Record<string, unknown>)
      : {};

  // Mode for the seeded conversation. Assessment nudges go to assessment
  // mode; everything else stays in general mode.
  const mode = pattern === "undebriefed_assessment" ? "assessment" : "general";

  const { data: convo, error: convoError } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: nudge.org_id,
      user_id: user.id,
      mode,
      context_ref: { from_nudge_id: nudge.id, pattern },
    })
    .select("id")
    .single();
  if (convoError || !convo) redirect("/dashboard");

  const openerText = await generateNudgeOpener({
    supabase,
    userId: user.id,
    pattern,
    patternData,
  });

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

  const actedAt = new Date().toISOString();
  await supabase
    .from("coach_nudges")
    .update({ acted_at: actedAt })
    .eq("id", nudge.id)
    .eq("user_id", user.id);

  if (nudge.notification_id) {
    await supabase
      .from("notifications")
      .update({ read_at: actedAt })
      .eq("id", nudge.notification_id)
      .eq("user_id", user.id);
  }

  redirect(`/coach-chat?c=${convo.id}`);
}
