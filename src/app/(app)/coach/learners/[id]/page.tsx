import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachNoteEditor } from "./coach-note-editor";
import { ActionItemsPanel } from "./action-items-panel";
import { RecapForm } from "./recap-form";

type Props = { params: Promise<{ id: string }> };

export default async function CoachLearnerPage({ params }: Props) {
  const { id: learnerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Verify coach assignment.
  const { data: assignment } = await supabase.from("coach_assignments")
    .select("id, org_id").eq("coach_user_id", user.id).eq("learner_user_id", learnerId).is("active_to", null).maybeSingle();
  // Also allow super_admins.
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle();
  if (!assignment && !profile?.super_admin) notFound();

  const [learnerProfile, goalsRes, actionsRes, reflectionsRes, assessmentRes, preSessionRes, coachNoteRes, recapsRes, itemsRes] = await Promise.all([
    supabase.from("profiles").select("display_name, timezone").eq("user_id", learnerId).maybeSingle(),
    supabase.from("goals").select("id, title, status, primary_lens, impact_self, impact_others, impact_org").eq("user_id", learnerId).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("action_logs").select("id, description, occurred_on, impact_area, reflection").eq("user_id", learnerId).order("occurred_on", { ascending: false }).limit(10),
    supabase.from("reflections").select("id, content, themes, reflected_on").eq("user_id", learnerId).order("reflected_on", { ascending: false }).limit(5),
    supabase.from("assessments").select("ai_summary").eq("user_id", learnerId).maybeSingle(),
    supabase.from("pre_session_notes").select("id, want_to_discuss, whats_been_hard, whats_going_well, session_date, created_at").eq("user_id", learnerId).order("created_at", { ascending: false }).limit(3),
    supabase.from("coach_notes").select("id, content, updated_at").eq("coach_user_id", user.id).eq("learner_user_id", learnerId).maybeSingle(),
    supabase.from("session_recaps").select("id, session_date, content, created_at").eq("learner_user_id", learnerId).order("session_date", { ascending: false }).limit(5),
    supabase.from("action_items").select("id, title, description, due_date, completed, completed_at").eq("learner_user_id", learnerId).order("completed").order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const name = learnerProfile.data?.display_name ?? "Unnamed learner";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 text-xs text-neutral-500">
        <Link href="/coach/dashboard" className="hover:text-brand-blue">← All learners</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-1">{name}</h1>
      <p className="text-sm text-neutral-500 mb-6">Learner detail — everything you need before and after a session.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: learner data */}
        <div className="space-y-5">
          {/* Goals */}
          <Section title="Goals" count={goalsRes.data?.length}>
            {(goalsRes.data ?? []).map((g) => (
              <div key={g.id} className="border-l-2 border-neutral-200 pl-3 py-1">
                <div className="font-medium text-sm">{g.title}</div>
                <div className="text-xs text-neutral-500">{g.status.replace("_", " ")}{g.primary_lens ? ` · started from ${g.primary_lens}` : ""}</div>
              </div>
            ))}
          </Section>

          {/* Recent actions */}
          <Section title="Recent actions (10)" count={actionsRes.data?.length}>
            {(actionsRes.data ?? []).map((a) => (
              <div key={a.id} className="text-sm">
                <span className="text-xs text-neutral-500 mr-2">{a.occurred_on}</span>
                {a.description}
                {a.reflection && <p className="text-xs italic text-neutral-500 mt-0.5">{a.reflection}</p>}
              </div>
            ))}
          </Section>

          {/* Reflections */}
          <Section title="Recent reflections (5)" count={reflectionsRes.data?.length}>
            {(reflectionsRes.data ?? []).map((r) => (
              <div key={r.id} className="text-sm">
                <span className="text-xs text-neutral-500 mr-2">{r.reflected_on}</span>
                <p className="line-clamp-3">{r.content}</p>
                {r.themes && r.themes.length > 0 && (
                  <div className="flex gap-1 mt-1">{r.themes.map((t: string) => (
                    <span key={t} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs">{t}</span>
                  ))}</div>
                )}
              </div>
            ))}
          </Section>

          {/* Assessments */}
          <Section title="Assessment summary">
            {assessmentRes.data?.ai_summary && typeof assessmentRes.data.ai_summary === "object" && Object.keys(assessmentRes.data.ai_summary).length > 0 ? (
              <div className="text-sm text-neutral-700">
                {Object.entries(assessmentRes.data.ai_summary as Record<string, { summary?: string }>).map(([key, val]) => (
                  <div key={key} className="mb-2">
                    <div className="font-medium text-neutral-800 text-xs uppercase">{key === "pi" ? "Predictive Index" : key === "eqi" ? "EQ-i 2.0" : key === "threesixty" ? "360 Feedback" : key}</div>
                    {val?.summary && <p>{val.summary}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-neutral-500">No assessments uploaded.</p>}
          </Section>
        </div>

        {/* Right column: coach tools */}
        <div className="space-y-5">
          {/* Pre-session notes */}
          <Section title="Pre-session notes" count={preSessionRes.data?.length}>
            {(preSessionRes.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">Learner hasn't submitted prep notes yet.</p>
            ) : (preSessionRes.data ?? []).map((n) => (
              <div key={n.id} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                <div className="text-xs text-neutral-500">{n.session_date ?? new Date(n.created_at).toLocaleDateString()}</div>
                <p className="font-medium">{n.want_to_discuss}</p>
                {n.whats_been_hard && <p className="text-neutral-600 text-xs mt-1">Hard: {n.whats_been_hard}</p>}
                {n.whats_going_well && <p className="text-neutral-600 text-xs mt-1">Well: {n.whats_going_well}</p>}
              </div>
            ))}
          </Section>

          {/* Coach notes */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-2">Your notes (private)</h2>
            <CoachNoteEditor learnerId={learnerId} initialContent={coachNoteRes.data?.content ?? ""} />
          </div>

          {/* Session recaps */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-2">Session recaps</h2>
            <RecapForm learnerId={learnerId} />
            {(recapsRes.data ?? []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(recapsRes.data ?? []).map((r) => (
                  <div key={r.id} className="border-l-2 border-neutral-200 pl-3 text-sm">
                    <div className="text-xs text-neutral-500">{r.session_date}</div>
                    <p className="line-clamp-4 text-neutral-700">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action items */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-2">Action items</h2>
            <ActionItemsPanel learnerId={learnerId} items={itemsRes.data ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number | null; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold mb-2">{title}{count != null ? ` (${count})` : ""}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
