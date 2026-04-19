import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CapstoneReadonly } from "@/components/capstone/capstone-readonly";
import { ProfileReadonly } from "@/components/profile/profile-readonly";
import { getConsultantSinceStats } from "@/lib/consultant/since-last-visit";
import { createClient } from "@/lib/supabase/server";
import { ConsultantLearnerNav } from "./consultant-learner-nav";
import { ConsultantSinceStrip } from "./since-strip";
import { ThoughtPartnerActivity } from "./thought-partner-activity";

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

  // Resolve learner's cohort first so we can build prev/next siblings.
  const { data: membership } = await supabase
    .from("memberships")
    .select("cohort_id, consultant_user_id, cohorts(id, name, consultant_user_id)")
    .eq("user_id", learnerId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const cohort = membership?.cohorts;

  // Sibling roster for prev/next nav — only when there's a cohort.
  let siblings: { id: string; name: string }[] = [];
  if (cohort?.id) {
    const { data: siblingMembers } = await supabase
      .from("memberships")
      .select("user_id, consultant_user_id, profiles:user_id(display_name)")
      .eq("cohort_id", cohort.id)
      .eq("role", "learner")
      .eq("status", "active");
    siblings = (
      (siblingMembers ?? []) as unknown as {
        user_id: string;
        consultant_user_id: string | null;
        profiles: { display_name: string | null } | null;
      }[]
    )
      .filter((m) => {
        if (profile?.super_admin) return true;
        const effective = m.consultant_user_id ?? cohort.consultant_user_id ?? null;
        return effective === user.id;
      })
      .map((m) => ({
        id: m.user_id,
        name: m.profiles?.display_name ?? "Unnamed learner",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const currentIdx = siblings.findIndex((s) => s.id === learnerId);
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next =
    currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  const today = new Date().toISOString().slice(0, 10);

  const [
    learnerProfile,
    goalsRes,
    sprintsRes,
    goalActionCountsRes,
    actionsRes,
    reflectionsRes,
    assessmentRes,
    recapsRes,
    capstoneRes,
    conversationsRes,
    nudgesRes,
    sinceStats,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, role_title, function_area, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, company_size, industry, context_notes, intake_completed_at",
      )
      .eq("user_id", learnerId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, title, status, primary_lens, target_date")
      .eq("user_id", learnerId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_sprints")
      .select(
        "id, goal_id, sprint_number, title, practice, planned_end_date, action_count, created_at, status",
      )
      .eq("user_id", learnerId)
      .eq("status", "active"),
    supabase
      .from("action_logs")
      .select("goal_id, occurred_on")
      .eq("user_id", learnerId)
      .not("goal_id", "is", null),
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
      .limit(8),
    supabase.from("assessments").select("ai_summary").eq("user_id", learnerId).maybeSingle(),
    supabase
      .from("session_recaps")
      .select("id, session_date, content, coach_user_id, profiles:coach_user_id(display_name)")
      .eq("learner_user_id", learnerId)
      .order("session_date", { ascending: false })
      .limit(5),
    supabase
      .from("capstone_outlines")
      .select("outline, status, shared_at, finalized_at, updated_at")
      .eq("user_id", learnerId)
      .maybeSingle(),
    supabase
      .from("ai_conversations")
      .select("id, title, mode, last_message_at")
      .eq("user_id", learnerId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("coach_nudges")
      .select("id, pattern, created_at, acted_at, dismissed_at")
      .eq("user_id", learnerId)
      .order("created_at", { ascending: false })
      .limit(5),
    getConsultantSinceStats(supabase, learnerId),
  ]);

  const name = learnerProfile.data?.display_name ?? "Unnamed learner";
  const isOverride = !!membership?.consultant_user_id && membership.consultant_user_id === user.id;

  // Per-goal action counts + active sprint info.
  const actionByGoal = new Map<string, { count: number; lastOccurredOn: string }>();
  for (const row of goalActionCountsRes.data ?? []) {
    if (!row.goal_id) continue;
    const existing = actionByGoal.get(row.goal_id);
    if (!existing) {
      actionByGoal.set(row.goal_id, { count: 1, lastOccurredOn: row.occurred_on });
    } else {
      existing.count += 1;
      if (row.occurred_on > existing.lastOccurredOn) existing.lastOccurredOn = row.occurred_on;
    }
  }
  const sprintByGoal = new Map((sprintsRes.data ?? []).map((s) => [s.goal_id, s] as const));

  type RecapRow = {
    id: string;
    session_date: string;
    content: string;
    coach_user_id: string;
    profiles: { display_name: string | null } | null;
  };
  const recaps = (recapsRes.data ?? []) as unknown as RecapRow[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {siblings.length > 1 && (
        <div className="mb-4">
          <ConsultantLearnerNav
            prev={prev}
            next={next}
            position={currentIdx + 1}
            total={siblings.length}
            cohortId={cohort?.id ?? null}
          />
        </div>
      )}

      <nav className="mb-3 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/consultant/dashboard" className="hover:text-brand-blue">
          Your cohorts
        </Link>
        {cohort && (
          <>
            <span aria-hidden>/</span>
            <Link href={`/consultant/cohorts/${cohort.id}`} className="hover:text-brand-blue">
              {cohort.name}
            </Link>
          </>
        )}
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{name}</span>
      </nav>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-brand-navy">{name}</h1>
        {isOverride && (
          <span
            title="You consult on this learner via per-learner override, not cohort default"
            className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
          >
            Override
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Read-only view — the learner's coach writes session notes and action items.
      </p>

      <div className="mb-6">
        <ConsultantSinceStrip stats={sinceStats} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Profile (from intake)">
          <ProfileReadonly profile={learnerProfile.data ?? null} />
        </Section>

        <Section title="Goals" count={goalsRes.data?.length}>
          {(goalsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No active goals.</p>
          ) : (
            (goalsRes.data ?? []).map((g) => {
              const sprint = sprintByGoal.get(g.id);
              const stats = actionByGoal.get(g.id);
              const sprintDay = sprint
                ? Math.min(
                    daysBetween(sprint.created_at.slice(0, 10), today) + 1,
                    Math.max(
                      1,
                      daysBetween(sprint.created_at.slice(0, 10), sprint.planned_end_date),
                    ),
                  )
                : null;
              const sprintTotal = sprint
                ? Math.max(1, daysBetween(sprint.created_at.slice(0, 10), sprint.planned_end_date))
                : null;
              return (
                <div key={g.id} className="border-l-2 border-neutral-200 py-1 pl-3">
                  <p className="text-sm font-medium text-brand-navy">{g.title}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {g.status.replace("_", " ")}
                    {g.primary_lens ? ` · from ${g.primary_lens}` : ""}
                    {g.target_date ? ` · target ${g.target_date}` : ""}
                  </p>
                  {sprint && sprintDay != null && sprintTotal != null ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 font-medium text-brand-blue">
                        Sprint {sprint.sprint_number} · day {sprintDay}/{sprintTotal}
                      </span>
                      <span className="text-neutral-600">
                        {sprint.action_count} action{sprint.action_count === 1 ? "" : "s"} this
                        sprint
                      </span>
                    </div>
                  ) : stats ? (
                    <p className="mt-1 text-[11px] text-neutral-500">
                      No active sprint · {stats.count} total action{stats.count === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-neutral-400">No sprint, no actions yet</p>
                  )}
                  {sprint?.practice && (
                    <p className="mt-1 text-[11px] italic text-neutral-600">
                      Practicing: {sprint.practice}
                    </p>
                  )}
                </div>
              );
            })
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
                {a.reflection && (
                  <p className="mt-0.5 text-xs italic text-neutral-500">{a.reflection}</p>
                )}
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
                <p className="whitespace-pre-wrap text-neutral-700">{r.content}</p>
                {r.themes && r.themes.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
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
            Object.entries(assessmentRes.data.ai_summary as Record<string, { summary?: string }>)
              .filter(([key]) => !key.startsWith("_"))
              .map(([key, val]) => (
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

        <Section title="Recent session recaps" count={recaps.length}>
          {recaps.length === 0 ? (
            <p className="text-sm text-neutral-500">No coach recaps yet.</p>
          ) : (
            recaps.map((r) => (
              <div key={r.id} className="border-l-2 border-neutral-200 py-1 pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>{r.session_date}</span>
                  {r.profiles?.display_name && (
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px]">
                      by {r.profiles.display_name}
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-neutral-700">{r.content}</p>
              </div>
            ))
          )}
        </Section>

        <ThoughtPartnerActivity
          conversations={conversationsRes.data ?? []}
          nudges={nudgesRes.data ?? []}
          anchorDate={sinceStats.anchorDate}
        />

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

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}
