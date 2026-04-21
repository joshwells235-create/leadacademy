import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessageThread } from "./message-thread";

type Props = { params: Promise<{ threadId: string }> };

export default async function ThreadPage({ params }: Props) {
  const { threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify user is a participant.
  const { data: participation } = await supabase
    .from("thread_participants")
    .select("id")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!participation) notFound();

  // Get the other participant's name.
  const { data: otherParticipant } = await supabase
    .from("thread_participants")
    .select("user_id")
    .eq("thread_id", threadId)
    .neq("user_id", user.id)
    .maybeSingle();
  const { data: otherProfile } = otherParticipant
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", otherParticipant.user_id)
        .maybeSingle()
    : { data: null };
  const otherName = otherProfile?.display_name ?? "Unknown";

  // Load messages.
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  // Mark thread as read.
  await supabase
    .from("thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/messages" className="text-xs text-neutral-500 hover:text-brand-blue">
            ← Messages
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
              {otherName.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-lg font-bold text-brand-navy">{otherName}</h1>
          </div>
        </div>
      </div>

      <MessageThread
        threadId={threadId}
        currentUserId={user.id}
        initialMessages={messages ?? []}
        otherName={otherName}
      />
    </div>
  );
}
