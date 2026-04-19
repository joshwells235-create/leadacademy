import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";
import { distillConversation } from "./distill";

const IDLE_HOURS = 2;
const MAX_PER_RUN = 5;

/**
 * Find up to N of the learner's prior conversations that are (a) idle for ≥2h,
 * (b) not yet distilled, (c) have enough messages — and distill them. Claims
 * each row by setting distilled_at BEFORE the LLM call to prevent races with
 * concurrent tabs. On failure, the row is released by reverting distilled_at
 * so the next run retries.
 *
 * Designed to be called fire-and-forget from the chat route when a new
 * conversation is created. Returns quickly if there's nothing to do.
 */
export async function distillPendingConversations(args: {
  userScoped: SupabaseClient<Database>;
  userId: string;
  orgId: string;
}): Promise<void> {
  const { userScoped, userId, orgId } = args;
  const admin = createAdminClient();

  const idleThreshold = new Date();
  idleThreshold.setHours(idleThreshold.getHours() - IDLE_HOURS);

  // Find candidates. Uses the learner-scoped client so RLS ensures we only
  // see the caller's own conversations.
  const { data: candidates } = await userScoped
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .is("distilled_at", null)
    .lt("last_message_at", idleThreshold.toISOString())
    .order("last_message_at", { ascending: true })
    .limit(MAX_PER_RUN);
  if (!candidates || candidates.length === 0) return;

  const now = new Date().toISOString();

  for (const row of candidates) {
    // Claim: set distilled_at only if still null. Admin client bypasses RLS
    // so the conditional update works cleanly.
    const { data: claimed } = await admin
      .from("ai_conversations")
      .update({ distilled_at: now })
      .eq("id", row.id)
      .is("distilled_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // another run claimed it first

    const result = await distillConversation({
      admin,
      learnerScoped: userScoped,
      conversationId: row.id,
      userId,
      orgId,
    });
    if (!result.ok) {
      // Release the claim so a future run retries.
      await admin
        .from("ai_conversations")
        .update({ distilled_at: null })
        .eq("id", row.id)
        .eq("distilled_at", now);
    }
  }
}
