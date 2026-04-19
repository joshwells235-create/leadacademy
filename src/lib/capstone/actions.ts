"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MODELS } from "@/lib/ai/client";
import { getCapstoneGate } from "@/lib/capstone/gate";
import { generateCapstoneOpener } from "@/lib/capstone/generate-opener";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

/**
 * Start (or resume) the learner's capstone conversation, then redirect
 * into /coach-chat with that conversation selected.
 *
 * - If the learner already has a capstone_outlines row with a linked
 *   conversation_id, resume that conversation (no new opener).
 * - Otherwise, create a new conversation in `capstone` mode, generate a
 *   story-arc opener from their full data, seed it as the assistant's
 *   first message, and create the capstone_outlines row.
 */
export async function startCapstoneSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const gate = await getCapstoneGate(supabase, user.id);
  if (gate.state !== "unlocked") return { error: "capstone not unlocked" };

  const { data: existing } = await supabase
    .from("capstone_outlines")
    .select("id, conversation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.conversation_id) {
    // Verify the conversation still exists and is owned by this user
    // before sending them to it (a super-admin could theoretically have
    // deleted it).
    const { data: convo } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", existing.conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (convo) {
      redirect(`/coach-chat?c=${convo.id}`);
    }
  }

  // New conversation in capstone mode.
  const { data: convo, error: convoError } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: gate.orgId,
      user_id: user.id,
      mode: "capstone",
      context_ref: { kind: "capstone" },
    })
    .select("id")
    .single();
  if (convoError || !convo)
    return { error: convoError?.message ?? "failed to create conversation" };

  const openerText = await generateCapstoneOpener({ supabase, userId: user.id });

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

  if (existing) {
    await supabase
      .from("capstone_outlines")
      .update({ conversation_id: convo.id })
      .eq("id", existing.id);
  } else {
    await supabase.from("capstone_outlines").insert({
      org_id: gate.orgId,
      user_id: user.id,
      cohort_id: gate.cohortId,
      conversation_id: convo.id,
      outline: {} as unknown as Json,
      status: "draft",
    });
  }

  revalidatePath("/capstone");
  redirect(`/coach-chat?c=${convo.id}`);
}

export async function shareCapstoneWithCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("capstone_outlines")
    .update({ status: "shared", shared_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/capstone");
  return { ok: true };
}

export async function finalizeCapstone() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("capstone_outlines")
    .update({
      status: "finalized",
      finalized_at: now,
      shared_at: now, // finalized implies shared
    })
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/capstone");
  return { ok: true };
}

export async function reopenCapstone() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("capstone_outlines")
    .update({ status: "draft", shared_at: null, finalized_at: null })
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/capstone");
  return { ok: true };
}

/**
 * Super-admin sets (or clears) the capstone unlock date on a cohort.
 * Uses the service-role client because cohorts RLS only grants write
 * access to org_admins within their own org, but this action is used by
 * super-admins on arbitrary cohorts.
 */
export async function setCohortCapstoneUnlocksAt(cohortId: string, date: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "super admin only" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("cohorts")
    .update({ capstone_unlocks_at: date })
    .eq("id", cohortId);
  if (error) return { error: error.message };

  revalidatePath(`/super/orgs`);
  return { ok: true };
}
