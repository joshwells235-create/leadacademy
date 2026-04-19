import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Messages — Leadership Academy" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get all threads the user participates in.
  const { data: participations } = await supabase
    .from("thread_participants")
    .select("thread_id, last_read_at")
    .eq("user_id", user!.id);

  const threadIds = (participations ?? []).map((p) => p.thread_id);
  const lastReadMap: Record<string, string> = {};
  for (const p of participations ?? []) { lastReadMap[p.thread_id] = p.last_read_at; }

  if (threadIds.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-brand-navy">Messages</h1>
        <p className="mt-1 text-sm text-neutral-600">Direct messages with your coach.</p>
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
            <span className="text-xl">💬</span>
          </div>
          <h2 className="font-semibold text-brand-navy">No conversations yet</h2>
          <p className="mt-1 text-sm text-neutral-600 max-w-sm mx-auto">
            When your coach messages you (or you message them from their profile), conversations will appear here.
          </p>
        </div>
      </div>
    );
  }

  // Get threads + other participants + latest message.
  const { data: threads } = await supabase.from("threads").select("id, kind, title, updated_at").in("id", threadIds).order("updated_at", { ascending: false });

  // Get all participants for these threads to find the "other person."
  const { data: allParticipants } = await supabase.from("thread_participants").select("thread_id, user_id").in("thread_id", threadIds);
  const otherUserIds = [...new Set((allParticipants ?? []).filter((p) => p.user_id !== user!.id).map((p) => p.user_id))];
  const { data: profiles } = otherUserIds.length > 0
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", otherUserIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  // Get the last message per thread.
  const lastMessages: Record<string, { body: string; sender_id: string; created_at: string }> = {};
  for (const tid of threadIds) {
    const { data: msg } = await supabase.from("messages").select("body, sender_id, created_at").eq("thread_id", tid).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (msg) lastMessages[tid] = msg;
  }

  // Count unread per thread.
  const unreadCounts: Record<string, number> = {};
  for (const tid of threadIds) {
    const readAt = lastReadMap[tid];
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("thread_id", tid).gt("created_at", readAt).neq("sender_id", user!.id);
    unreadCounts[tid] = count ?? 0;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy">Messages</h1>
      <p className="mt-1 text-sm text-neutral-600 mb-6">Direct messages with your coach.</p>

      <ul className="space-y-2">
        {(threads ?? []).map((t) => {
          const otherParticipant = (allParticipants ?? []).find((p) => p.thread_id === t.id && p.user_id !== user!.id);
          const otherName = otherParticipant ? (profileMap.get(otherParticipant.user_id) ?? "Unknown") : (t.title ?? "Thread");
          const last = lastMessages[t.id];
          const unread = unreadCounts[t.id] ?? 0;

          return (
            <li key={t.id}>
              <Link href={`/messages/${t.id}`} className={`flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md ${unread > 0 ? "border-brand-blue/30" : "border-neutral-200"}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white shrink-0">
                  {otherName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${unread > 0 ? "font-bold text-brand-navy" : "font-medium text-neutral-800"}`}>{otherName}</span>
                    {last && <span className="text-xs text-neutral-400 shrink-0">{timeAgo(last.created_at)}</span>}
                  </div>
                  {last && (
                    <p className={`text-sm truncate ${unread > 0 ? "text-brand-navy font-medium" : "text-neutral-500"}`}>
                      {last.sender_id === user!.id ? "You: " : ""}{last.body}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white shrink-0">
                    {unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
