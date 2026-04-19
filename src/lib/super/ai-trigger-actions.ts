"use server";

import { revalidatePath } from "next/cache";
import { distillConversation } from "@/lib/ai/memory/distill";
import { detectAndFireNudge } from "@/lib/ai/nudges/detect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireSuperAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "Not authorized." };
  return { userId: user.id };
}

async function log(opts: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: opts.actorId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    details: (opts.details ?? {}) as never,
  });
}

/**
 * Force-run memory distillation for a single learner. Picks up every
 * undistilled conversation regardless of idle age and processes up to
 * MAX. Useful when a conversation is producing clearly-wrong behavior
 * and the super-admin wants to rebuild the learner's memory facts.
 */
export async function runMemoryDistillation(
  userId: string,
): Promise<{ ok: true; distilled: number } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const MAX = 10;

  const { data: membership } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.org_id ?? null;

  const { data: candidates } = await admin
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .is("distilled_at", null)
    .order("last_message_at", { ascending: true, nullsFirst: false })
    .limit(MAX);

  if (!candidates || candidates.length === 0 || !orgId) {
    await log({
      actorId: ctx.userId,
      action: "super.ai.distillation_triggered",
      targetType: "profile",
      targetId: userId,
      details: { distilled: 0, reason: !orgId ? "no active membership" : "nothing pending" },
    });
    return { ok: true, distilled: 0 };
  }

  const now = new Date().toISOString();
  let processed = 0;
  for (const row of candidates) {
    const { data: claimed } = await admin
      .from("ai_conversations")
      .update({ distilled_at: now })
      .eq("id", row.id)
      .is("distilled_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      const result = await distillConversation({
        admin,
        learnerScoped: admin,
        conversationId: row.id,
        userId,
        orgId,
      });
      if (result.ok) processed += 1;
    } catch {
      // Release the claim so a subsequent run retries.
      await admin.from("ai_conversations").update({ distilled_at: null }).eq("id", row.id);
    }
  }

  await log({
    actorId: ctx.userId,
    action: "super.ai.distillation_triggered",
    targetType: "profile",
    targetId: userId,
    details: { distilled: processed, candidates: candidates.length },
  });

  revalidatePath(`/super/orgs/${orgId}/members/${userId}`);
  return { ok: true, distilled: processed };
}

/**
 * Force-run nudge detection for a learner. Respects the same rate
 * limits (weekly cap, per-pattern cooldown) and the
 * `profiles.proactivity_enabled` opt-out. Returns what fired (or why
 * nothing did).
 */
export async function runNudgeDetection(
  userId: string,
): Promise<{ ok: true; fired: boolean; pattern?: string | null } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const res = await detectAndFireNudge(admin, userId);

  await log({
    actorId: ctx.userId,
    action: "super.ai.nudge_detection_triggered",
    targetType: "profile",
    targetId: userId,
    details: { fired: res.fired, pattern: res.pattern ?? null },
  });

  const { data: membership } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (membership?.org_id) {
    revalidatePath(`/super/orgs/${membership.org_id}/members/${userId}`);
  }

  return { ok: true, fired: res.fired, pattern: res.pattern ?? null };
}
