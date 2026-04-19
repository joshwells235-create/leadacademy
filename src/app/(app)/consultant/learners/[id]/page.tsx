import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CapstoneReadonly } from "@/components/capstone/capstone-readonly";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function ConsultantLearnerPage({ params }: Props) {
  const { id: learnerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Authorization: current user is the consultant of the learner's cohort,
  // or super_admin.
  const { data: isConsultant } = await supabase.rpc("is_consultant_of_learner", {
    p_learner: learnerId,
  });
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isConsultant && !profile?.super_admin) notFound();

  const [
    learnerProfile,
    membershipRes,
    goalsRes,
    actionsRes,
    reflectionsRes,
    assessmentRes,
    recapsRes,
    capstoneRes,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", learnerId).maybeSingle(),
    supabase
      .from("memberships")
      .select("cohort_id, cohorts(id, name)")
      .eq("user_id", learnerId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, title, status, primary_lens, target_date")
      .eq("user_id", learnerId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("action_logs")
      .select("id, description, occurred_on, impact_area, reflection")
      .eq("user_id", learnerId)
      .order("occurred_on", { ascending: false })
      .limit(15),
    supabase
      .from("reflections")
      .select("id, content, themes, reflected_on")
      .eq("user_id", learnerId)
      .order("reflected_on", { ascending: false })
      .limit(5),
    supabase.from("assessments").select("ai_summary").eq("user_id", learnerId).maybeSingle(),
    supabase
      .from("session_recaps")
      .select("id, session_date, content")
      .eq("learner_user_id", learnerId)
      .order("session_date", { ascending: false })
      .limit(3),
    supabase
      .from("capstone_outlines")
      .select("outline, status, shared_at, finalized_at, updated_at")
      .eq("user_id", learnerId)
      .maybeSingle(),
  ]);

  const name = learnerProfile.data?.display_name ?? "Unnamed learner";
  const cohort = membershipRes.data?.cohorts;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/consultant/dashboard" className="hover:text-brand-blue">
          Your cohorts
        </Link>
        {cohort && (
          <>
            <span>/</span>
            <Link href={`/consultant/cohorts/${cohort.id}`} className="hover:text-brand-blue">
              {cohort.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-medium text-brand-navy">{name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-brand-navy">{name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Read-only view — the learner's coach owns session notes and action items.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section title="Goals" count={goalsRes.data?.length}>
          {(goalsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No goals yet.</p>
          ) : (
            (goalsRes.data ?? []).map((g) => (
              <div key={g.id} className="border-l-2 border-neutral-200 py-1 pl-3">
                <div className="text-sm font-medium text-brand-navy">{g.title}</div>
                <div className="text-xs text-neutral-500">
                  {g.status.replace("_", " ")}
                  {g.primary_lens ? ` · from ${g.primary_lens}` : ""}
                  {g.target_date ? ` · target ${g.target_date}` : ""}
                </div>
              </div>
            ))
          )}
        </Section>

        <Section title="Recent actions" count={actionsRes.data?.length}>
          {(actionsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No actions logged.</p>
          ) : (
            (actionsRes.data ?? []).map((a) => (
              <div key={a.id} className="text-sm">
                <span className="mr-2 text-xs text-neutral-500">{a.occurred_on}</span>
                {a.description}
              </div>
            ))
          )}
        </Section>

        <Section title="Recent reflections" count={reflectionsRes.data?.length}>
          {(reflectionsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No reflections.</p>
          ) : (
            (reflectionsRes.data ?? []).map((r) => (
              <div key={r.id} className="text-sm">
                <span className="mr-2 text-xs text-neutral-500">{r.reflected_on}</span>
                <p className="line-clamp-3">{r.content}</p>
                {r.themes && r.themes.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {r.themes.map((t: string) => (
                      <span
                        key={t}
                        className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </Section>

        <Section title="Assessment summary">
          {assessmentRes.data?.ai_summary &&
          typeof assessmentRes.data.ai_summary === "object" &&
          Object.keys(assessmentRes.data.ai_summary).length > 0 ? (
            Object.entries(
              assessmentRes.data.ai_summary as Record<string, { summary?: string }>,
            ).map(([key, val]) => (
              <div key={key} className="mb-2">
                <div className="text-xs font-medium uppercase text-neutral-500">
                  {key === "pi"
                    ? "Predictive Index"
                    : key === "eqi"
                      ? "EQ-i 2.0"
                      : key === "threesixty"
                        ? "360 Feedback"
                        : key}
                </div>
                {val?.summary && <p className="text-sm text-neutral-700">{val.summary}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-500">No assessments uploaded.</p>
          )}
        </Section>

        <Section title="Recent session recaps" count={recapsRes.data?.length}>
          {(recapsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No coach recaps yet.</p>
          ) : (
            (recapsRes.data ?? []).map((r) => (
              <div key={r.id} className="text-sm">
                <span className="mr-2 text-xs text-neutral-500">{r.session_date}</span>
                <p className="line-clamp-4">{r.content}</p>
              </div>
            ))
          )}
        </Section>

        <Section title="Capstone">
          <CapstoneReadonly row={capstoneRes.data ?? null} viewerRole="admin" />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-brand-navy">
        {title}
        {count != null ? ` (${count})` : ""}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
