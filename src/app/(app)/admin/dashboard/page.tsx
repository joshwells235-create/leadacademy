import Link from "next/link";
import { getCohortVitality } from "@/lib/consultant/cohort-vitality";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const orgId = mem?.org_id;
  if (!orgId) return <div className="p-8">No org found.</div>;

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoIso = fourteenDaysAgo.toISOString().slice(0, 10);
  const today = new Date();

  const [membersRes, cohortsRes, assignmentsRes, invitationsRes, recentActionsRes, profilesRes] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("id, user_id, role, status, cohort_id")
        .eq("org_id", orgId),
      supabase
        .from("cohorts")
        .select("id, name, starts_at, ends_at, capstone_unlocks_at")
        .eq("org_id", orgId)
        .order("starts_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("coach_assignments")
        .select("learner_user_id, coach_user_id")
        .eq("org_id", orgId)
        .is("active_to", null),
      supabase.from("invitations").select("id, consumed_at, expires_at").eq("org_id", orgId),
      supabase
        .from("action_logs")
        .select("user_id, occurred_on")
        .eq("org_id", orgId)
        .gte("occurred_on", fourteenDaysAgoIso),
      supabase.from("profiles").select("user_id, intake_completed_at"),
    ]);

  const members = membersRes.data ?? [];
  const activeMembers = members.filter((m) => m.status === "active");
  const learners = activeMembers.filter((m) => m.role === "learner");
  const coaches = activeMembers.filter((m) => m.role === "coach" || m.role === "org_admin");

  const assignments = assignmentsRes.data ?? [];
  const learnersWithCoach = new Set(assignments.map((a) => a.learner_user_id));
  const learnersWithoutCoach = learners.filter((l) => !learnersWithCoach.has(l.user_id)).length;

  const recentActions = recentActionsRes.data ?? [];
  const activeLearnerIds = new Set(recentActions.map((a) => a.user_id));
  const activeLearners = learners.filter((l) => activeLearnerIds.has(l.user_id)).length;

  const profileByUser = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p] as const));
  const intakeIncomplete = learners.filter(
    (l) => !profileByUser.get(l.user_id)?.intake_completed_at,
  ).length;

  const invitations = invitationsRes.data ?? [];
  const pendingInvites = invitations.filter(
    (i) => !i.consumed_at && new Date(i.expires_at) > today,
  ).length;
  const expiredInvites = invitations.filter(
    (i) => !i.consumed_at && new Date(i.expires_at) <= today,
  ).length;
  const acceptedInvites = invitations.filter((i) => i.consumed_at).length;

  const cohorts = cohortsRes.data ?? [];
  const endingSoon = cohorts.filter((c) => {
    if (!c.ends_at) return false;
    const days = Math.round(
      (new Date(`${c.ends_at}T00:00:00Z`).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return days >= 0 && days <= 30;
  });

  // Per-cohort vitality — reuses the consultant helper so numbers are
  // consistent across portals.
  const learnersByCohort = new Map<string, string[]>();
  for (const l of learners) {
    if (!l.cohort_id) continue;
    const list = learnersByCohort.get(l.cohort_id) ?? [];
    list.push(l.user_id);
    learnersByCohort.set(l.cohort_id, list);
  }
  const cohortVit = await Promise.all(
    cohorts.map(async (c) => {
      const ids = learnersByCohort.get(c.id) ?? [];
      const vit = await getCohortVitality(supabase, ids, c.id);
      return { ...c, vit };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-navy">Overview</h2>
        <p className="mt-0.5 text-sm text-neutral-600">Health of your program at a glance.</p>
      </div>

      {/* Vitality metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Active members" value={activeMembers.length} href="/admin/people" />
        <Stat
          label="Learners"
          value={learners.length}
          detail={`${coaches.length} coaches`}
          href="/admin/people"
        />
        <Stat
          label="Active in 14d"
          value={activeLearners}
          detail={pctLabel(activeLearners, learners.length)}
          tone={toneFromRatio(activeLearners, learners.length)}
          href="/admin/people"
        />
        <Stat
          label="No coach"
          value={learnersWithoutCoach}
          tone={learnersWithoutCoach > 0 ? "warn" : "good"}
          detail={pctLabel(learners.length - learnersWithoutCoach, learners.length)}
          href="/admin/people"
          hint="Learners with no active coach assignment"
        />
        <Stat
          label="Intake pending"
          value={intakeIncomplete}
          tone={intakeIncomplete > 0 ? "warn" : "good"}
          href="/admin/people"
        />
        <Stat
          label="Pending invites"
          value={pendingInvites}
          detail={expiredInvites > 0 ? `${expiredInvites} expired` : `${acceptedInvites} accepted`}
          tone={expiredInvites > 0 ? "warn" : "neutral"}
          href="/admin/people"
        />
      </section>

      {/* Cohorts ending soon */}
      {endingSoon.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            {endingSoon.length} cohort{endingSoon.length === 1 ? "" : "s"} ending in the next 30
            days
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {endingSoon.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <Link href={`/admin/cohorts/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs">ends {c.ends_at}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Per-cohort vitality */}
      {cohorts.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-navy">Cohorts</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 text-left font-medium">Cohort</th>
                <th className="px-3 py-2 text-center font-medium">Learners</th>
                <th className="px-3 py-2 text-center font-medium">Active 14d</th>
                <th className="px-3 py-2 text-center font-medium">Active sprint</th>
                <th className="px-3 py-2 text-center font-medium">No coach</th>
                <th className="px-3 py-2 text-center font-medium">Overdue</th>
                <th className="px-3 py-2 text-center font-medium">Capstone shared</th>
              </tr>
            </thead>
            <tbody>
              {cohortVit.map((c) => (
                <tr key={c.id} className="border-b border-neutral-50 hover:bg-brand-light">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/cohorts/${c.id}`}
                      className="font-medium text-brand-navy hover:text-brand-blue hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {c.starts_at && <>Starts {c.starts_at}</>}
                      {c.starts_at && c.ends_at && <> · </>}
                      {c.ends_at && <>Ends {c.ends_at}</>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">{c.vit.learnerCount}</td>
                  <td className="px-3 py-2.5 text-center">
                    <CellValue
                      value={c.vit.activeLast14d}
                      total={c.vit.learnerCount}
                      tone={toneFromRatio(c.vit.activeLast14d, c.vit.learnerCount)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <CellValue value={c.vit.withActiveSprint} total={c.vit.learnerCount} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <CellValue
                      value={c.vit.withoutCoach}
                      total={c.vit.learnerCount}
                      tone={c.vit.withoutCoach > 0 ? "warn" : "good"}
                      invertPct
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <CellValue
                      value={c.vit.learnersOverdue}
                      total={c.vit.learnerCount}
                      tone={c.vit.learnersOverdue > 0 ? "warn" : "good"}
                      invertPct
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <CellValue
                      value={c.vit.capstoneShared + c.vit.capstoneFinalized}
                      total={c.vit.learnerCount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

type Tone = "neutral" | "good" | "okay" | "warn";

function Stat({
  label,
  value,
  detail,
  tone = "neutral",
  href,
  hint,
}: {
  label: string;
  value: number;
  detail?: string;
  tone?: Tone;
  href?: string;
  hint?: string;
}) {
  const toneClass = {
    neutral: "text-brand-navy",
    good: "text-emerald-700",
    okay: "text-brand-blue",
    warn: "text-amber-700",
  }[tone];
  const inner = (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-xl font-bold ${toneClass}`}>{value}</span>
        {detail && <span className="text-[11px] text-neutral-500">{detail}</span>}
      </div>
      {hint && <p className="mt-0.5 text-[10px] text-neutral-400">{hint}</p>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-brand-blue/40 hover:shadow-md"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">{inner}</div>;
}

function CellValue({
  value,
  total,
  tone = "neutral",
  invertPct = false,
}: {
  value: number;
  total: number;
  tone?: Tone;
  invertPct?: boolean;
}) {
  const pct = total === 0 ? null : Math.round((value / total) * 100);
  const toneClass = {
    neutral: "text-neutral-700",
    good: "text-emerald-700",
    okay: "text-brand-blue",
    warn: "text-amber-700",
  }[tone];
  return (
    <span>
      <span className={`font-semibold ${toneClass}`}>{value}</span>
      {pct != null && total > 0 && (
        <span className="ml-1 text-[11px] text-neutral-500">({invertPct ? 100 - pct : pct}%)</span>
      )}
    </span>
  );
}

function pctLabel(n: number, total: number): string {
  if (total === 0) return "";
  return `${Math.round((n / total) * 100)}%`;
}

function toneFromRatio(n: number, total: number): Tone {
  if (total === 0) return "neutral";
  const ratio = n / total;
  if (ratio >= 0.7) return "good";
  if (ratio >= 0.4) return "okay";
  return "warn";
}
