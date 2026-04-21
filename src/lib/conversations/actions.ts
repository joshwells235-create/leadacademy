"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const titleSchema = z.string().trim().min(1).max(80);

export async function deleteConversation(conversationId: string) {
  const parsed = uuidSchema.safeParse(conversationId);
  if (!parsed.success) return { error: "bad id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // Intentionally NO revalidatePath here. The sidebar handles UI refresh via
  // router.refresh() (inactive delete) or router.push("/coach-chat/new")
  // (active delete). Adding revalidatePath races the client navigation: the
  // server re-renders the stale /coach-chat?c=<deletedId> URL and would seed
  // a replacement conversation, while router.push concurrently seeds another
  // at /coach-chat?new=1 — net effect is the deleted chat being replaced by
  // two identical seeded openers. Leave the refresh to the client.
  return { ok: true };
}

export async function renameConversation(conversationId: string, title: string) {
  const parsedId = uuidSchema.safeParse(conversationId);
  if (!parsedId.success) return { error: "bad id" };
  const parsedTitle = titleSchema.safeParse(title);
  if (!parsedTitle.success) return { error: "title must be 1-80 characters" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: parsedTitle.data })
    .eq("id", parsedId.data)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // Rename is benign re: the seed-race — no conversation disappears — but
  // we still rely on the client's router.refresh() for the UI update.
  return { ok: true };
}
