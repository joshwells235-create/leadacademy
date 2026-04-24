import Link from "next/link";
import { notFound } from "next/navigation";
import { CapstoneReadonly } from "@/components/capstone/capstone-readonly";
import { ProfileReadonly } from "@/components/profile/profile-readonly";
import { getConsultantSinceStats } from "@/lib/consultant/since-last-visit";
import { createClient } from "@/lib/supabase/server";
import { AiTriggersPanel } from "./ai-triggers-panel";
import { SuperCoachPanel } from "./coach-panel";
import { ConsultantOverridePanel } from "./consultant-override-panel";
import { SuperSinceStrip } from "./since-strip";

type Props = { params: Promise<{ id: string; userId: string }> };

const NUDGE_LABEL: Record<string, string> = {
  sprint_ending_soon: "Sprint ending soon",
  sprint_needs_review: "Sprint needs review",
  challenge_followup: "Challenge follow-up",
  undebriefed_assessment: "Un-debriefed assessment",
  sprint_quiet: "Sprint quiet",
  reflection_streak_broken: "Reflection streak broken",
  new_course_waiting: "New course waiting",
  momentum_surge: "Momentum surge",
  goal_check_in: "Goal check-in",
};

export default async function SuperLearnerPage({ params }: Props) {
  const { id: orgId, userId } = await params;
  const supabase = await createClient();

  const [
    learnerProfile,
    goalsRes,
    sprintsRes,
    actionsRes,
    reflectionsRes,
    assessmentRes,
    conversationsRes,
    nudgesRes,
    memoryRes,
    recapsRes,
    coachNotesRes,
    actionItemsRes,
    capstoneRes,
    learnerMembershipRes,
    consultantCandidatesRes,
    sinceStats,
    superAdminCandidatesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, timezone, role_title, function_area, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, company_size, industry, context_notes, intake_completed_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, title, status, primary_lens, impact_self, impact_others, impact_org, created_at")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_sprints")
      .select("id, goal_id, title, status, planned_end_date, action_count, created_at")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("action_logs")
      .select("id, description, occurred_on, impact_area")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .limit(15),
    supabase
      .from("reflections")
      .select("id, content, themes, reflected_on")
      .eq("user_id", userId)
      .order("reflected_on", { ascending: false })
      .limit(10),
    supabase.from("assessments").select("ai_summary").eq("user_id", userId).maybeSingle(),
    supabase
      .from("ai_conversations")
      .select("id, mode, last_message_at, title")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(15),
    supabase
      .from("coach_nudges")
      .select("id, pattern, created_at, acted_at, dismissed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("learner_memory")
      .select("id, type, content, confidence, edited_by_user, source_conversation_id, updated_at")
      .eq("user_id", userId)
      .eq("deleted_by_user", false)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("session_recaps")
      .select(
        "id, content, session_date, created_at, coach_user_id, profiles:coach_user_id(display_name)",
      )
      .eq("learner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("coach_notes")
      .select("id, content, created_at, coach_user_id, profiles:coach_user_id(display_name)")
      .eq("learner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("action_items")
      .select(
        "id, title, description, completed, completed_at, due_date, created_at, coach_user_id, profiles:coach_user_id(display_name)",
      )
      .eq("learner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("capstone_outlines")
      .select("outline, status, shared_at, finalized_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("consultant_user_id, cohort_id, cohorts(id, consultant_user_id)")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("user_id, profiles:user_id(display_name)")
      .eq("org_id", orgId)
      .eq("role", "consultant")
      .eq("status", "active"),
    getConsultantSinceStats(supabase, userId),
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("super_admin", true)
      .is("deleted_at", null),
  ]);

  const [coachCandidatesRes, currentCoachRes, superAdminCoachesRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, profiles:user_id(display_name)")
      .eq("org_id", orgId)
      .in("role", ["coach", "org_admin"])
      .eq("status", "active"),
    supabase
      .from("coach_assignments")
      .select("coach_user_id, profiles:coach_user_id(display_name)")
      .eq("learner_user_id", userId)
      .is("active_to", null)
      .limit(1)
      .maybeSingle(),
    // Super admins are valid coach candidates regardless of whether they
    // hold a coach/org_admin membership in this org — they commonly flex
    // into the coach seat for a specific learner without being invited
    // org-by-org.
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("super_admin", true)
      .is("deleted_at", null),
  ]);

  const coachSeen = new Set<string>();
  const coachCandidates: { user_id: string; display_name: string | null }[] = [];
  for (const c of coachCandidatesRes.data ?? []) {
    if (coachSeen.has(c.user_id)) continue;
    coachSeen.add(c.user_id);
    coachCandidates.push({
      user_id: c.user_id,
      display_name:
        (c.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
    });
  }
  for (const s of superAdminCoachesRes.data ?? []) {
    if (coachSeen.has(s.user_id)) continue;
    coachSeen.add(s.user_id);
    coachCandidates.push({
      user_id: s.user_id,
      display_name: s.display_name ? `${s.display_name} (super)` : "super admin",
    });
  }
  const currentCoachUserId = currentCoachRes.data?.coach_user_id ?? null;
  const currentCoachName =
    (currentCoachRes.data?.profiles as unknown as { display_name: string | null } | null)
      ?.display_name ?? null;

  if (!learnerProfile.data) notFound();

  const mem = learnerMembershipRes.data;
  const cohortDefaultConsultantId = mem?.cohorts?.consultant_user_id ?? null;
  const overrideConsultantId = mem?.consultant_user_id ?? null;

  const consultantSeen = new Set<string>();
  const consultantCandidates: { user_id: string; display_name: string | null }[] = [];
  for (const c of consultantCandidatesRes.data ?? []) {
    if (consultantSeen.has(c.user_id)) continue;
    consultantSeen.add(c.user_id);
    consultantCandidates.push({
      user_id: c.user_id,
      display_name:
        (c.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
    });
  }
  for (const s of superAdminCandidatesRes.data ?? []) {
    if (consultantSeen.has(s.user_id)) continue;
    consultantSeen.add(s.user_id);
    consultantCandidates.push({
      user_id: s.user_id,
      display_name: s.display_name ? `${s.display_name} (super)` : "super admin",
    });
  }
  const nameById = new Map(consultantCandidates.map((c) => [c.user_id, c.display_name]));
  const overrideConsultantName = overrideConsultantId
    ? (nameById.get(overrideConsultantId) ?? null)
    : null;
  const cohortDefaultConsultantName = cohortDefaultConsultantId
    ? (nameById.get(cohortDefaultConsultantId) ?? null)
    : null;

  const name = learnerProfile.data.display_name ?? "Unknown";

  const goals = goalsRes.data ?? [];
  const sprints = sprintsRes.data ?? [];
  const sprintByGoal = new Map(sprints.map((s) => [s.goal_id, s]));
  const nudges = nudgesRes.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/orgs" className="hover:text-brand-blue">
          Orgs
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/super/orgs/${orgId}`} className="hover:text-brand-blue">
          Org
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{name}</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">{name}</h1>
        <Link href={`/super/users/${userId}`} className="text-xs text-brand-blue hover:underline">
          Edit user (email, role, delete…) →
        </Link>
      </div>

      <div className="mb-6">
        <SuperSinceStrip stats={sinceStats} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="About this leader">
          <ProfileReadonly profile={learnerProfile.data ?? null} />
        </Section>

        <Section title="Goals" count={goals.length}>
          {goals.length === 0 ? (
            <p className="text-sm text-neutral-500">No active goals.</p>
          ) : (
            goals.map((g) => {
              const sprint = sprintByGoal.get(g.id);
              return (
                <div key={g.id} className="border-l-2 border-neutral-200 pl-3 py-1">
                  <div className="font-medium text-sm text-brand-navy">{g.title}</div>
                  <div className="text-xs text-neutral-500">{g.status.replace("_", " ")}</div>
                  {sprint && (
                    <div className="mt-1 text-[11px] text-brand-blue">
                      Sprint: {sprint.title} · {sprint.action_count ?? 0} action
                      {sprint.action_count === 1 ? "" : "s"}
                      {sprint.planned_end_date && ` · ends ${sprint.planned_end_date}`}
                    </div>
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
                <span className="text-xs text-neutral-400 mr-2">{a.occurred_on}</span>
                {a.description}
              </div>
            ))
          )}
        </Section>

        <Section title="Recent reflections" count={reflectionsRes.data?.length}>
          {(reflectionsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No reflections yet.</p>
          ) : (
            (reflectionsRes.data ?? []).map((r) => (
              <div key={r.id} className="text-sm">
                <span className="text-xs text-neutral-400 mr-2">{r.reflected_on}</span>
                <span className="line-clamp-2">{r.content}</span>
                {r.themes && r.themes.length > 0 && (
                  <div className="flex gap-1 mt-1">
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
                <div className="font-medium text-xs uppercase text-neutral-500">
                  {key === "pi"
                    ? "Predictive Index"
                    : key === "eqi"
                      ? "EQ-i 2.0"
                      : key === "_combined_themes"
                        ? "Combined themes"
                        : "360 feedback"}
                </div>
                {val?.summary && <p className="text-sm text-neutral-700">{val.summary}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-500">No assessments uploaded.</p>
          )}
        </Section>

        <Section title="AI conversations" count={conversationsRes.data?.length}>
          {(conversationsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No conversations yet.</p>
          ) : (
            (conversationsRes.data ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/super/conversations/${c.id}`}
                className="block text-sm hover:text-brand-blue transition"
              >
                <span className="rounded-full bg-brand-blue-light px-1.5 py-0.5 text-[10px] text-brand-blue mr-1">
                  {c.mode}
                </span>
                {c.title ?? "Untitled"}
                {" — "}
                {c.last_message_at
                  ? new Date(c.last_message_at).toLocaleDateString()
                  : "no messages"}
              </Link>
            ))
          )}
        </Section>

        <Section title="Nudge history" count={nudges.length}>
          {nudges.length === 0 ? (
            <p className="text-sm text-neutral-500">No nudges fired.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {nudges.map((n) => {
                const state = n.acted_at ? "acted" : n.dismissed_at ? "dismissed" : "pending";
                const tone =
                  state === "acted"
                    ? "text-emerald-700"
                    : state === "dismissed"
                      ? "text-neutral-500"
                      : "text-amber-700";
                return (
                  <li key={n.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-neutral-700">
                      {NUDGE_LABEL[n.pattern] ?? n.pattern}
                    </span>
                    <span className={`shrink-0 text-[11px] ${tone}`}>
                      {state} · {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Memory facts" count={memoryRes.data?.length ?? 0}>
          {(memoryRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing distilled yet. Memory facts accumulate from conversations idle ≥2h.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(memoryRes.data ?? []).map((m) => (
                <li key={m.id} className="border-l-2 border-neutral-200 pl-3 py-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                      {m.type}
                    </span>
                    <span className="rounded-full bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-500">
                      {m.confidence}
                    </span>
                    {m.edited_by_user && (
                      <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[10px] text-brand-blue">
                        user-edited
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-neutral-400">
                      {new Date(m.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-neutral-800">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Coach session recaps" count={recapsRes.data?.length ?? 0}>
          {(recapsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No recaps written yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(recapsRes.data ?? []).map((r) => (
                <li key={r.id} className="border-l-2 border-neutral-200 pl-3 py-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-brand-navy">
                      {(r.profiles as unknown as { display_name: string | null } | null)
                        ?.display_name ?? "Unknown coach"}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {r.session_date ?? new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-neutral-700 line-clamp-3">{r.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Coach notes (private)" count={coachNotesRes.data?.length ?? 0}>
          {(coachNotesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No notes recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(coachNotesRes.data ?? []).map((n) => (
                <li key={n.id} className="border-l-2 border-neutral-200 pl-3 py-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-brand-navy">
                      {(n.profiles as unknown as { display_name: string | null } | null)
                        ?.display_name ?? "Unknown coach"}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-neutral-700 line-clamp-3">{n.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Action items" count={actionItemsRes.data?.length ?? 0}>
          {(actionItemsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No action items.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {(actionItemsRes.data ?? []).map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm ${a.completed ? "bg-emerald-500" : "bg-neutral-200"}`}
                    aria-label={a.completed ? "Completed" : "Open"}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-neutral-800 ${a.completed ? "line-through text-neutral-500" : ""}`}
                    >
                      {a.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
                      {a.due_date && <span>due {a.due_date}</span>}
                      {a.completed && a.completed_at && (
                        <span>done {new Date(a.completed_at).toLocaleDateString()}</span>
                      )}
                      <span>
                        by{" "}
                        {(a.profiles as unknown as { display_name: string | null } | null)
                          ?.display_name ?? "Unknown coach"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Capstone">
          <CapstoneReadonly row={capstoneRes.data ?? null} viewerRole="admin" />
        </Section>

        <SuperCoachPanel
          learnerUserId={userId}
          currentCoachUserId={currentCoachUserId}
          currentCoachName={currentCoachName}
          candidates={coachCandidates}
        />

        {mem && (
          <ConsultantOverridePanel
            learnerUserId={userId}
            currentOverrideUserId={overrideConsultantId}
            currentOverrideName={overrideConsultantName}
            cohortDefaultUserId={cohortDefaultConsultantId}
            cohortDefaultName={cohortDefaultConsultantName}
            candidates={consultantCandidates}
          />
        )}

        <AiTriggersPanel userId={userId} />
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
      <h2 className="text-sm font-semibold text-brand-navy mb-3">
        {title}
        {count != null ? ` (${count})` : ""}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
