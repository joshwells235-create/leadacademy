import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  MEMORY_CONFIDENCES,
  MEMORY_TYPES,
  type MemoryConfidence,
  type MemoryFact,
  type MemoryType,
} from "./types";

/**
 * Load a learner's non-deleted memory facts, newest-touched first. Used both
 * by context assembly (top-N on every turn) and the privacy UI (full list).
 */
export async function listMemoryFacts(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { limit?: number } = {},
): Promise<MemoryFact[]> {
  const { limit = 200 } = opts;
  const { data } = await supabase
    .from("learner_memory")
    .select(
      "id, type, content, confidence, source_conversation_id, source_excerpt, first_seen, last_seen, edited_by_user, expires_at",
    )
    .eq("user_id", userId)
    .eq("deleted_by_user", false)
    .order("last_seen", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    type: normalizeType(row.type),
    content: row.content,
    confidence: normalizeConfidence(row.confidence),
    sourceConversationId: row.source_conversation_id,
    sourceExcerpt: row.source_excerpt,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    editedByUser: row.edited_by_user,
    expiresAt: row.expires_at,
  }));
}

function normalizeType(raw: string): MemoryType {
  return (MEMORY_TYPES as readonly string[]).includes(raw) ? (raw as MemoryType) : "other";
}

function normalizeConfidence(raw: string): MemoryConfidence {
  return (MEMORY_CONFIDENCES as readonly string[]).includes(raw)
    ? (raw as MemoryConfidence)
    : "medium";
}
