import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string; userId: string }> };

export default async function SuperLearnerPage({ params }: Props) {
  const { id: orgId, userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const [learnerProfile, goalsRes, actionsRes, reflectionsRes, assessmentRes, conversationsRes] = await Promise.all([
    supabase.from("profiles").select("display_name, timezone").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("id, title, status, primary_lens, impact_self, impact_others, impact_org").eq("user_id", userId).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("action_logs").select("id, description, occurred_on, impact_area").eq("user_id", userId).order("occurred_on", { ascending: false }).limit(15),
    supabase.from("reflections").select("id, content, themes, reflected_on").eq("user_id", userId).order("reflected_on", { ascending: false }).limit(10),
    supabase.from("assessments").select("ai_summary").eq("user_id", userId).maybeSingle(),
    supabase.from("ai_conversations").select("id, mode, last_message_at, title").eq("user_id", userId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(10),
  ]);

  const name = learnerProfile.data?.display_name ?? "Unknown";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/orgs" className="hover:text-brand-blue">Orgs</Link>
        <span>/</span>
        <Link href={`/super/orgs/${orgId}`} className="hover:text-brand-blue">Org</Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-brand-navy mb-6">{name}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Goals */}
        <Section title="Goals" count={goalsRes.data?.length}>
          {(goalsRes.data ?? []).map((g) => (
            <div key={g.id} className="border-l-2 border-neutral-200 pl-3 py-1">
              <div className="font-medium text-sm text-brand-navy">{g.title}</div>
              <div className="text-xs text-neutral-500">{g.status.replace("_", " ")}</div>
            </div>
          ))}
        </Section>

        {/* Actions */}
        <Section title="Recent Actions" count={actionsRes.data?.length}>
          {(actionsRes.data ?? []).map((a) => (
            <div key={a.id} className="text-sm"><span className="text-xs text-neutral-400 mr-2">{a.occurred_on}</span>{a.description}</div>
          ))}
        </Section>

        {/* Reflections */}
        <Section title="Recent Reflections" count={reflectionsRes.data?.length}>
          {(reflectionsRes.data ?? []).map((r) => (
            <div key={r.id} className="text-sm">
              <span className="text-xs text-neutral-400 mr-2">{r.reflected_on}</span>
              <span className="line-clamp-2">{r.content}</span>
              {r.themes && r.themes.length > 0 && (
                <div className="flex gap-1 mt-1">{r.themes.map((t: string) => <span key={t} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px]">{t}</span>)}</div>
              )}
            </div>
          ))}
        </Section>

        {/* Assessment summary */}
        <Section title="Assessment Summary">
          {assessmentRes.data?.ai_summary && typeof assessmentRes.data.ai_summary === "object" && Object.keys(assessmentRes.data.ai_summary).length > 0 ? (
            Object.entries(assessmentRes.data.ai_summary as Record<string, { summary?: string }>).map(([key, val]) => (
              <div key={key} className="mb-2">
                <div className="font-medium text-xs uppercase text-neutral-500">{key === "pi" ? "Predictive Index" : key === "eqi" ? "EQ-i 2.0" : "360 Feedback"}</div>
                {val?.summary && <p className="text-sm text-neutral-700">{val.summary}</p>}
              </div>
            ))
          ) : <p className="text-sm text-neutral-500">No assessments uploaded.</p>}
        </Section>

        {/* AI Conversations */}
        <Section title="AI Conversations" count={conversationsRes.data?.length}>
          {(conversationsRes.data ?? []).map((c) => (
            <Link key={c.id} href={`/super/conversations/${c.id}`} className="block text-sm hover:text-brand-blue transition">
              <span className="rounded-full bg-brand-blue-light px-1.5 py-0.5 text-[10px] text-brand-blue mr-1">{c.mode}</span>
              {c.title ?? "Untitled"} — {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : "no messages"}
            </Link>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number | null; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-navy mb-3">{title}{count != null ? ` (${count})` : ""}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
