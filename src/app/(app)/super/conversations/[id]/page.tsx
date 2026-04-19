import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteConversationButton } from "./delete-button";
import { MessageBody } from "./message-body";

type Props = { params: Promise<{ id: string }> };

export default async function ConversationViewPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: convo } = await supabase
    .from("ai_conversations")
    .select(
      "id, mode, title, created_at, last_message_at, user_id, org_id, profiles:user_id(display_name), organizations:org_id(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!convo) notFound();

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("id, role, content, model, tokens_in, tokens_out, latency_ms, created_at")
    .eq("conversation_id", id)
    .order("created_at");

  const learnerName =
    (convo.profiles as unknown as { display_name: string | null })?.display_name ?? "Unknown";
  const orgName = (convo.organizations as unknown as { name: string })?.name ?? "";

  const msgs = messages ?? [];
  const totalTokensIn = msgs.reduce((s, m) => s + (m.tokens_in ?? 0), 0);
  const totalTokensOut = msgs.reduce((s, m) => s + (m.tokens_out ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/conversations" className="hover:text-brand-blue">
          Conversations
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/super/orgs/${convo.org_id}/members/${convo.user_id}`}
          className="hover:text-brand-blue"
        >
          {learnerName}
        </Link>
      </nav>

      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-brand-navy">
            {convo.title ?? `${learnerName}'s conversation`}
          </h1>
          <DeleteConversationButton
            conversationId={convo.id}
            userId={convo.user_id}
            orgId={convo.org_id}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          <span>{orgName}</span>
          <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-brand-blue">
            {convo.mode}
          </span>
          <span>
            {msgs.length} message{msgs.length === 1 ? "" : "s"}
          </span>
          <span>
            {totalTokensIn.toLocaleString()}→{totalTokensOut.toLocaleString()} tokens
          </span>
          {convo.last_message_at && (
            <span>Last active {new Date(convo.last_message_at).toLocaleString()}</span>
          )}
        </div>
      </div>

      {msgs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No messages in this conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg p-4 ${
                m.role === "user"
                  ? "bg-brand-blue/10 border border-brand-blue/20"
                  : m.role === "assistant"
                    ? "bg-white border border-neutral-200 shadow-sm"
                    : "bg-neutral-100 border border-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <span
                  className={`text-xs font-medium ${
                    m.role === "user"
                      ? "text-brand-blue"
                      : m.role === "assistant"
                        ? "text-brand-navy"
                        : "text-neutral-500"
                  }`}
                >
                  {m.role === "user"
                    ? "Learner"
                    : m.role === "assistant"
                      ? "Thought Partner"
                      : m.role}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
                  {m.model && <span className="font-mono">{m.model}</span>}
                  {m.tokens_in != null && (
                    <span>
                      {m.tokens_in}→{m.tokens_out} tok
                    </span>
                  )}
                  {m.latency_ms != null && <span>{m.latency_ms}ms</span>}
                  <span title={new Date(m.created_at).toLocaleString()}>
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <MessageBody content={m.content} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
