import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Record a failed AI call (or extraction, or distillation) for
 * super-admin triage. Intentionally swallows its own errors — logging
 * must never throw its way back into the caller's failure path.
 *
 * Feature is a stable short label so the viewer can group by it:
 *   - "chat" (thought partner conversation turn)
 *   - "distill" (memory distillation)
 *   - "title" (Haiku conversation title)
 *   - "extract_pi" / "extract_eqi" / "extract_360" (assessment extraction)
 *   - "extract_combined" (combined-themes synthesis)
 *   - "nudge_opener" (proactive nudge opener generation)
 *   - "recap_draft" (coach session recap draft)
 */
export async function logAiError(opts: {
  feature: string;
  error: unknown;
  model?: string | null;
  orgId?: string | null;
  userId?: string | null;
  conversationId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const message =
      opts.error instanceof Error
        ? opts.error.message
        : typeof opts.error === "string"
          ? opts.error
          : JSON.stringify(opts.error);
    await admin.from("ai_errors").insert({
      feature: opts.feature,
      model: opts.model ?? null,
      org_id: opts.orgId ?? null,
      user_id: opts.userId ?? null,
      conversation_id: opts.conversationId ?? null,
      error_message: message.slice(0, 2000),
      error_details: (opts.details ?? {}) as never,
    });
  } catch {
    // Swallow — never let logging break the hot path.
  }
}
