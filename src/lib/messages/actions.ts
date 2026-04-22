"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Find or create a DM thread between two users. */
export async function getOrCreateDMThread(otherUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  // Org_id for the thread: prefer the sender's org (most common path),
  // fall back to the receiver's when the sender is a super_admin or a
  // coach without their own membership row. Without this fallback,
  // super_admin coaches silently couldn't start threads.
  const { data: senderMem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  let orgId: string | null = senderMem?.org_id ?? null;
  if (!orgId) {
    const { data: receiverMem } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", otherUserId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    orgId = receiverMem?.org_id ?? null;
  }
  if (!orgId) {
    return { error: "Neither party has an active membership — can't route the thread." };
  }
  const mem = { org_id: orgId };

  // Check if a DM thread already exists between these two users.
  const { data: existing } = await supabase
    .from("thread_participants")
    .select("thread_id")
    .eq("user_id", user.id);
  const myThreadIds = (existing ?? []).map((t) => t.thread_id);

  if (myThreadIds.length > 0) {
    const { data: shared } = await supabase
      .from("thread_participants")
      .select("thread_id")
      .eq("user_id", otherUserId)
      .in("thread_id", myThreadIds);
    if (shared && shared.length > 0) {
      // Verify it's a DM thread.
      const { data: thread } = await supabase.from("threads").select("id, kind").eq("id", shared[0].thread_id).eq("kind", "dm").maybeSingle();
      if (thread) return { threadId: thread.id };
    }
  }

  // Create a new DM thread.
  const { data: thread, error: tErr } = await supabase.from("threads").insert({ org_id: mem.org_id, kind: "dm" }).select("id").single();
  if (tErr || !thread) return { error: tErr?.message ?? "failed" };

  // Add both participants.
  await supabase.from("thread_participants").insert([
    { thread_id: thread.id, user_id: user.id },
    { thread_id: thread.id, user_id: otherUserId },
  ]);

  return { threadId: thread.id };
}

/** Send a message in a thread. */
export async function sendMessage(threadId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  if (!body.trim()) return { error: "empty message" };

  const { data: msg, error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    body: body.trim(),
  }).select("id").single();
  if (error) return { error: error.message };

  // Update the thread's updated_at for sorting.
  await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

  // Update sender's last_read_at.
  await supabase.from("thread_participants").update({ last_read_at: new Date().toISOString() }).eq("thread_id", threadId).eq("user_id", user.id);

  // Create notification for the other participant(s).
  const { data: participants } = await supabase.from("thread_participants").select("user_id").eq("thread_id", threadId).neq("user_id", user.id);
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const senderName = profile?.display_name ?? "Someone";

  const admin = createAdminClient();
  for (const p of participants ?? []) {
    await admin.from("notifications").insert({
      user_id: p.user_id,
      type: "new_message",
      title: `New message from ${senderName}`,
      body: body.trim().slice(0, 100) + (body.trim().length > 100 ? "..." : ""),
      link: `/messages/${threadId}`,
    });
  }

  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return { id: msg.id };
}

/** Mark a thread as read for the current user. */
export async function markThreadRead(threadId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("thread_participants").update({ last_read_at: new Date().toISOString() }).eq("thread_id", threadId).eq("user_id", user.id);
}

/** Mark a notification as read. */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  revalidatePath("/");
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/");
}

/** Create a notification (called from other server actions). */
export async function createNotification(userId: string, type: string, title: string, body: string, link?: string) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
}
