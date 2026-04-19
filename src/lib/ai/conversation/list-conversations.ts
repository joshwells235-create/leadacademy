import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type ConversationListItem = {
  id: string;
  title: string | null;
  mode: string;
  lastMessageAt: string | null;
  createdAt: string;
  previewText: string;
};

/**
 * List the learner's own conversations for the sidebar, newest first.
 * Includes a preview snippet derived from the first user message so the
 * sidebar is usable before the Haiku-generated title arrives.
 */
export async function listConversations(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 50,
): Promise<ConversationListItem[]> {
  const { data: rows } = await supabase
    .from("ai_conversations")
    .select("id, title, mode, last_message_at, created_at")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const conversations = rows ?? [];
  if (conversations.length === 0) return [];

  const ids = conversations.map((c) => c.id);
  const { data: previewRows } = await supabase
    .from("ai_messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", ids)
    .eq("role", "user")
    .order("created_at", { ascending: true });

  const firstUserByConvo = new Map<string, string>();
  for (const r of previewRows ?? []) {
    if (firstUserByConvo.has(r.conversation_id)) continue;
    firstUserByConvo.set(r.conversation_id, extractFirstText(r.content));
  }

  return conversations.map((c) => ({
    id: c.id,
    title: c.title,
    mode: c.mode,
    lastMessageAt: c.last_message_at,
    createdAt: c.created_at,
    previewText: firstUserByConvo.get(c.id) ?? "",
  }));
}

function extractFirstText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const parts = (content as { parts?: unknown[] }).parts;
  if (!Array.isArray(parts)) return "";
  for (const p of parts) {
    if (
      p &&
      typeof p === "object" &&
      (p as { type?: string }).type === "text" &&
      typeof (p as { text?: unknown }).text === "string"
    ) {
      return (p as { text: string }).text;
    }
  }
  return "";
}
