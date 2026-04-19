import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type StoredUIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<Record<string, unknown>>;
};

export type LoadedConversation = {
  id: string;
  title: string | null;
  mode: string;
  contextRef: Record<string, unknown>;
  createdAt: string;
  lastMessageAt: string | null;
  messages: StoredUIMessage[];
};

/**
 * Load a conversation by id along with its messages, reshaped into the
 * UIMessage format the `useChat` hook replays as initialMessages. Returns
 * null if the conversation doesn't exist or RLS denies access.
 *
 * Older assistant messages persisted before the full-response fix land
 * here as empty `parts` arrays — the chat component renders a subtle
 * "(older response not archived)" note for those.
 */
export async function loadConversation(
  supabase: SupabaseClient<Database>,
  conversationId: string,
): Promise<LoadedConversation | null> {
  const { data: convo } = await supabase
    .from("ai_conversations")
    .select("id, title, mode, context_ref, created_at, last_message_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return null;

  const { data: messageRows } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const messages: StoredUIMessage[] = (messageRows ?? []).map((row) => ({
    id: row.id,
    role: row.role === "assistant" || row.role === "system" ? row.role : "user",
    parts: extractParts(row.content, row.role),
  }));

  return {
    id: convo.id,
    title: convo.title,
    mode: convo.mode,
    contextRef:
      convo.context_ref &&
      typeof convo.context_ref === "object" &&
      !Array.isArray(convo.context_ref)
        ? (convo.context_ref as Record<string, unknown>)
        : {},
    createdAt: convo.created_at,
    lastMessageAt: convo.last_message_at,
    messages,
  };
}

function extractParts(content: unknown, role: string): Array<Record<string, unknown>> {
  if (!content || typeof content !== "object") return [];
  const parts = (content as { parts?: unknown[] }).parts;
  if (Array.isArray(parts)) {
    return parts.filter((p): p is Record<string, unknown> => p !== null && typeof p === "object");
  }
  // Legacy assistant messages (pre-fix) stored only { finishReason }. Render
  // a placeholder so the transcript doesn't collapse silently.
  if (role === "assistant") {
    return [{ type: "text", text: "(older response not archived)" }];
  }
  return [];
}
