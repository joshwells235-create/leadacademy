import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/client";
import {
  generateThoughtPartnerOpener,
  type OpenerLens,
  type OpenerMode,
} from "@/lib/thought-partner/generate-opener";
import type { Database, Json } from "@/lib/types/database";

type CreateArgs = {
  supabase: SupabaseClient<Database>;
  userId: string;
  orgId: string;
  mode: OpenerMode;
  lens?: OpenerLens;
};

/**
 * Create a new thought-partner conversation seeded with an opening assistant
 * message so the learner never lands on a blank canvas. Mirrors the pattern
 * used by intake / capstone / assessment-debrief / from-nudge.
 *
 * Returns the new conversation id. Caller is responsible for redirecting.
 * On DB failure, returns null — caller decides the fallback.
 */
export async function createSeededThoughtPartnerConversation(
  args: CreateArgs,
): Promise<string | null> {
  const { supabase, userId, orgId, mode, lens } = args;

  const contextRef: Record<string, string> = {};
  if (lens) contextRef.primaryLens = lens;

  const { data: convo, error: convoError } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: orgId,
      user_id: userId,
      mode,
      context_ref: contextRef as unknown as Json,
    })
    .select("id")
    .single();
  if (convoError || !convo) return null;

  const openerText = await generateThoughtPartnerOpener({ supabase, userId, mode, lens });

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
