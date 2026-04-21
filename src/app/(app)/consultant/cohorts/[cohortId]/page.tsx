import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCohortVitality } from "@/lib/consultant/cohort-vitality";
import { createClient } from "@/lib/supabase/server";
import { CoachesPanel, type CoachSummary, type LearnerAssignmentRow } from "./coaches-panel";
import { CohortEditor } from "./cohort-editor";
import { CohortRoster, type RosterLearner } from "./cohort-roster";

type Props = { params: Promise<{ cohortId: string }> };

type MemberRow = {
  user_id: string;
  role: string;
  org_id: string;
  consultant_user_id: string | null;
  organizations: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

export default async function ConsultantCohortPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cohort } = await supabase
    .from("cohorts")
    .select(
      "id, name, description, starts_at, ends_at, capstone_unlocks_at, consultant_user_id, organizations(id, name)",
    )
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: membersRaw } = await supabase
    .from("memberships")
    .select(
      "user_id, role, org_id, consultant_user_id, organizations(name), profiles:user_id(display_name)",
    )
    .eq("cohort_id", cohortId)
    .eq("status", "active");
  const members = (membersRaw ?? []) as unknown as MemberRow[];

  // Scope to learners the viewer effectively consults on.
  const isDefaultConsultant = cohort.consultant_user_id === user.id;
  const learnersAll = members.filter((m) => m.role === "learner");
  const learners = profile?.super_admin
    ? learnersAll
    : learnersAll.filter((m) => {
        const effective = m.consultant_user_id ?? cohort.consultant_user_id ?? null;
        return effective === user.id;
      });
  const coachMembers = members.filter((m) => m.role === "coach");

  if (!profile?.super_admin && !isDefaultConsultant && learners.length === 0) {
    notFound();
  }

  const learnerIds = learners.map((l) => l.user_id);
  const today = new Date().toISOString().slice(0, 10);

  const [sprintsRes, actionsRes, capstonesRes, coachAssignmentsRes, vitality] = await Promise.all([
    learnerIds.length
      ? supabase
          .from("goal_sprints")
          .select("user_id, status")
          .in("user_id", learnerIds)
          .eq("status", "active")
      : { data: [] as { user_id: string; status: string }[] },
    learnerIds.length
      ? supabase
          .from("action_logs")
          .select("user_id, occurred_on")
          .in("user_id", learnerIds)
          .order("occurred_on", { ascending: false })
      : { data: [] as { user_id: string; occurred_on: string }[] },
    learnerIds.length
      ? supabase.from("capstone_outlines").select("user_id, status").in("user_id", learnerIds)
      : { data: [] as { user_id: string; status: string }[] },
    learnerIds.length
      ? supabase
          .from("coach_assignments")
          .select("learner_user_id, coach_user_id, profiles:coach_user_id(display_name)")
          .in("learner_user_id", learnerIds)
          .is("active_to", null)
      : { data: [] as unknown[] },
    getCohortVitality(supabase, learnerIds, cohortId),
  ]);

  const activeSprintByUser = new Map<string, number>();
  for (const s of sprintsRes.data ?? []) {
    activeSprintByUser.set(s.user_id, (activeSprintByUser.get(s.user_id) ?? 0) + 1);
  }
  const lastActionByUser = new Map<string, string>();
  for (const a of actionsRes.data ?? []) {
    if (!lastActionByUser.has(a.user_id)) lastActionByUser.set(a.user_id, a.occurred_on);
  }
  const capstoneStatusByUser = new Map<string, string>();
  for (const c of capstonesRes.data ?? []) {
    capstoneStatusByUser.set(c.user_id, c.status);
  }

  type CoachAssignmentRow = {
    learner_user_id: string;
    coach_user_id: string;
    profiles: { display_name: string | null } | null;
  };
  const coachByLearner = new Map<string, { coachUserId: string; coachName: string }>();
  const coachLoad = new Map<string, number>();
  for (const a of (coachAssignmentsRes.data ?? []) as CoachAssignmentRow[]) {
    coachByLearner.set(a.learner_user_id, {
      coachUserId: a.coach_user_id,
      coachName: a.profiles?.display_name ?? "Unnamed coach",
    });
    coachLoad.set(a.coach_user_id, (coachLoad.get(a.coach_user_id) ?? 0) + 1);
  }

  const rosterLearners: RosterLearner[] = learners.map((m) => {
    const assignment = coachByLearner.get(m.user_id);
    return {
      userId: m.user_id,
      name: m.profiles?.display_name ?? "Unnamed learner",
      activeSprint: activeSprintByUser.get(m.user_id) ?? 0,
      lastAction: lastActionByUser.get(m.user_id) ?? null,
      capstoneStatus: capstoneStatusByUser.get(m.user_id) ?? null,
      coachName: assignment?.coachName ?? null,
      isOverride: m.consultant_user_id === user.id && !isDefaultConsultant,
      orgName: m.organizations?.name ?? null,
    };
  });

  const coachAssignments: LearnerAssignmentRow[] = learners.map((m) => {
    const assignment = coachByLearner.get(m.user_id);
    return {
      userId: m.user_id,
      name: m.profiles?.display_name ?? "Unnamed learner",
      coachUserId: assignment?.coachUserId ?? null,
      coachName: assignment?.coachName ?? null,
    };
  });

  const coaches: CoachSummary[] = coachMembers.map((c) => ({
    userId: c.user_id,
    name: c.profiles?.display_name ?? "Unnamed coach",
    assignedCount: coachLoad.get(c.user_id) ?? 0,
  }));

  const canEditCohort = isDefaultConsultant || profile?.super_admin;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/consultant/dashboard" className="hover:text-brand-blue">
          Your cohorts
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{cohort.name}</span>
      </nav>

      <header className="mb-6">
        <p className="text-xs text-neutral-500">{cohort.organizations?.name ?? "Unknown org"}</p>
        <h1 className="mt-0.5 text-2xl font-bold text-brand-navy">{cohort.name}</h1>
        {cohort.description && (
          <p className="mt-2 text-sm text-neutral-600">{cohort.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          {cohort.starts_at && <span>Starts {cohort.starts_at}</span>}
          {cohort.ends_at && <span>Ends {cohort.ends_at}</span>}
          {cohort.capstone_unlocks_at && (
            <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 font-medium text-brand-navy">
              Capstone unlocks {cohort.capstone_unlocks_at}
            </span>
          )}
          {canEditCohort && (
            <CohortEditor
              cohortId={cohort.id}
              initialDescription={cohort.description}
              initialCapstoneUnlocksAt={cohort.capstone_unlocks_at}
            />
          )}
        </div>
      </header>

      {/* At-a-glance cohort vitality */}
      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Learners" value={vitality.learnerCount} />
        <Metric
          label="Active in 14d"
          value={vitality.activeLast14d}
          detail={pctLabel(vitality.activeLast14d, vitality.learnerCount)}
          tone={toneFromRatio(vitality.activeLast14d, vitality.learnerCount)}
        />
        <Metric
          label="Active sprint"
          value={vitality.withActiveSprint}
          detail={pctLabel(vitality.withActiveSprint, vitality.learnerCount)}
        />
        <Metric
          label="Assessments complete"
          value={vitality.assessmentsComplete}
          detail={pctLabel(vitality.assessmentsComplete, vitality.learnerCount)}
        />
        <Metric
          label="Capstone shared"
          value={vitality.capstoneShared + vitality.capstoneFinalized}
          detail={pctLabel(
            vitality.capstoneShared + vitality.capstoneFinalized,
            vitality.learnerCount,
          )}
        />
        <Metric
          label="Capstone finalized"
          value={vitality.capstoneFinalized}
          detail={pctLabel(vitality.capstoneFinalized, vitality.learnerCount)}
        />
        <Metric
          label="No coach assigned"
          value={vitality.withoutCoach}
          tone={vitality.withoutCoach > 0 ? "warn" : "neutral"}
        />
        <Metric label="Reflections (30d)" value={vitality.reflectionsLast30d} />
      </section>

      {/* Reflection themes across the cohort */}
      {vitality.topThemes.length > 0 && (
        <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-navy">
            Themes surfacing across the cohort
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Last 30 days · aggregated from learner reflections
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {vitality.topThemes.map((t) => (
              <span
                key={t.theme}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-800"
              >
                {t.theme}
                <span className="ml-1 text-neutral-500">×{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <CohortRoster learners={rosterLearners} todayIso={today} />

      <div className="mt-5">
        <CoachesPanel coaches={coaches} learners={coachAssignments} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail?: string;
  tone?: "neutral" | "good" | "okay" | "warn";
}) {
  const toneClass = {
    neutral: "text-brand-navy",
    good: "text-emerald-700",
    okay: "text-brand-blue",
    warn: "text-amber-700",
  }[tone];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className={`text-xl font-bold ${toneClass}`}>{value}</span>
        {detail && <span className="text-[11px] text-neutral-500">{detail}</span>}
      </div>
    </div>
  );
}

function pctLabel(n: number, total: number): string {
  if (total === 0) return "";
  return `${Math.round((n / total) * 100)}%`;
}

function toneFromRatio(n: number, total: number): "neutral" | "good" | "okay" | "warn" {
  if (total === 0) return "neutral";
  const ratio = n / total;
  if (ratio >= 0.7) return "good";
  if (ratio >= 0.4) return "okay";
  return "warn";
}
