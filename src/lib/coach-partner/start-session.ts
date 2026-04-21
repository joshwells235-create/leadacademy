import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/client";
import type { Database, Json } from "@/lib/types/database";
import { generateCoachPartnerOpener } from "./generate-opener";

type Args = {
  supabase: SupabaseClient<Database>;
  coachUserId: string;
  orgId: string;
  /** Optional — scopes the conversation to a single coachee. */
  learnerId?: string;
  /** Optional — framing kind ("weekly_review" for the Sunday-thinking ritual). */
  kind?: "weekly_review";
};

/**
 * Create a seeded coach-partner conversation. Inserts the ai_conversations
 * row, generates the Sonnet opener, writes it as the first assistant
 * message, stamps last_message_at, and returns the new conversation id.
 *
 * Caller is responsible for authorization (is this user a coach? if
 * learner-scoped, do they coach that learner?) AND for redirecting the
 * user to `/coach-chat?c=<id>`. This function deliberately doesn't redirect
 * so it can be used both from server actions (which can redirect) and from
 * server components (which must not await a redirect).
 */
export async function createSeededCoachPartnerConversation(
  args: Args,
): Promise<string | null> {
  const { supabase, coachUserId, orgId, learnerId, kind } = args;

  const contextRef: Record<string, string> = {};
  if (learnerId) contextRef.learnerId = learnerId;
  if (kind) contextRef.kind = kind;

  const { data: convo, error } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: orgId,
      user_id: coachUserId,
      mode: "coach_partner",
      context_ref: contextRef as unknown as Json,
    })
    .select("id")
    .single();
  if (error || !convo) return null;

  const openerText = await generateCoachPartnerOpener({
    supabase,
    coachUserId,
    learnerUserId: learnerId,
    kind,
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

  return convo.id;
}

