"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// --- Pre-session notes (learner-authored) ---
const preSessionSchema = z.object({
  wantToDiscuss: z.string().min(1).max(5000),
  whatsBeenHard: z.string().max(5000).optional(),
  whatsGoingWell: z.string().max(5000).optional(),
  sessionDate: z.string().optional(),
});

export type PreSessionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

export async function createPreSessionNote(
  _prev: PreSessionState,
  formData: FormData,
): Promise<PreSessionState> {
  const parsed = preSessionSchema.safeParse({
    wantToDiscuss: formData.get("wantToDiscuss"),
    whatsBeenHard: formData.get("whatsBeenHard") || undefined,
    whatsGoingWell: formData.get("whatsGoingWell") || undefined,
    sessionDate: formData.get("sessionDate") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "not signed in" };
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return { status: "error", message: "no membership" };

  const { error } = await supabase.from("pre_session_notes").insert({
    user_id: user.id,
    org_id: mem.org_id,
    want_to_discuss: parsed.data.wantToDiscuss,
    whats_been_hard: parsed.data.whatsBeenHard ?? null,
    whats_going_well: parsed.data.whatsGoingWell ?? null,
    session_date: parsed.data.sessionDate ?? null,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/pre-session");
  revalidatePath("/dashboard");
  return { status: "success", message: "Pre-session notes saved." };
}

// --- Coach notes (coach-private, upsert) ---
export async function saveCoachNote(learnerId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return { error: "no membership" };

  const { error } = await supabase.from("coach_notes").upsert(
    {
      coach_user_id: user.id,
      learner_user_id: learnerId,
      org_id: mem.org_id,
      content,
    },
    { onConflict: "coach_user_id,learner_user_id" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}

// --- Session recaps ---
export async function createSessionRecap(learnerId: string, content: string, sessionDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return { error: "no membership" };

  const { data, error } = await supabase
    .from("session_recaps")
    .insert({
      coach_user_id: user.id,
      learner_user_id: learnerId,
      org_id: mem.org_id,
      session_date: sessionDate,
      content,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/coach/learners/${learnerId}`);
  return { ok: true, id: data.id };
}

// --- Action items ---
export async function createActionItem(
  learnerId: string,
  title: string,
  description?: string,
  dueDate?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return { error: "no membership" };

  const { error } = await supabase.from("action_items").insert({
    coach_user_id: user.id,
    learner_user_id: learnerId,
    org_id: mem.org_id,
    title,
    description: description ?? null,
    due_date: dueDate ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/coach/learners/${learnerId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleActionItem(itemId: string) {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("action_items")
    .select("completed")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "not found" };
  const { error } = await supabase
    .from("action_items")
    .update({
      completed: !item.completed,
      completed_at: !item.completed ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
