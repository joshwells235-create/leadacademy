import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function ConversationViewPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: convo } = await supabase.from("ai_conversations").select("id, mode, user_id, org_id, profiles:user_id(display_name), organizations:org_id(name)").eq("id", id).maybeSingle();
  if (!convo) notFound();

  const { data: messages } = await supabase.from("ai_messages").select("id, role, content, model, tokens_in, tokens_out, latency_ms, created_at").eq("conversation_id", id).order("created_at");

  const learnerName = (convo.profiles as unknown as { display_name: string | null })?.display_name ?? "Unknown";
  const orgName = (convo.organizations as unknown as { name: string })?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/conversations" className="hover:text-brand-blue">Conversations</Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{learnerName}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-navy">{learnerName}'s conversation</h1>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
          <span>{orgName}</span>
          <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-brand-blue">{convo.mode}</span>
          <span>{messages?.length ?? 0} messages</span>
        </div>
      </div>

      <div className="space-y-3">
        {(messages ?? []).map((m) => {
          const contentText = typeof m.content === "string" ? m.content :
            typeof m.content === "object" && m.content !== null ? JSON.stringify(m.content) : "";
          return (
            <div key={m.id} className={`rounded-lg p-4 ${m.role === "user" ? "bg-brand-blue/10 border border-brand-blue/20" : m.role === "assistant" ? "bg-white border border-neutral-200 shadow-sm" : "bg-neutral-100 border border-neutral-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${m.role === "user" ? "text-brand-blue" : m.role === "assistant" ? "text-brand-navy" : "text-neutral-500"}`}>
                  {m.role === "user" ? "Learner" : m.role === "assistant" ? "Coach (AI)" : m.role}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                  {m.model && <span className="font-mono">{m.model}</span>}
                  {m.tokens_in != null && <span>{m.tokens_in}→{m.tokens_out} tok</span>}
                  {m.latency_ms != null && <span>{m.latency_ms}ms</span>}
                  <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </div>
              <div className="text-sm text-neutral-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {contentText.slice(0, 2000)}{contentText.length > 2000 ? "..." : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
