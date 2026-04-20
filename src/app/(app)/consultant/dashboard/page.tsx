import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCohortVitality } from "@/lib/consultant/cohort-vitality";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Consultant — Leadership Academy" };

type CohortRow = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  capstone_unlocks_at: string | null;
  consultant_user_id: string | null;
  organizations: { id: string; name: string } | null;
};

export default async function ConsultantDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cohort IDs reachable two ways: default (cohorts.consultant_user_id = me)
  // OR per-learner override (memberships.consultant_user_id = me).
  const [defaultCohortsRes, overrideMembershipsRes] = await Promise.all([
    supabase.from("cohorts").select("id").eq("consultant_user_id", user.id),
    supabase
      .from("memberships")
      .select("cohort_id")
      .eq("consultant_user_id", user.id)
      .eq("status", "active")
      .not("cohort_id", "is", null),
  ]);

  const cohortIdSet = new Set<string>();
  for (const c of defaultCohortsRes.data ?? []) cohortIdSet.add(c.id);
  for (const m of overrideMembershipsRes.data ?? []) {
    if (m.cohort_id) cohortIdSet.add(m.cohort_id);
  }
  const cohortIdsToFetch = Array.from(cohortIdSet);

  const { data: cohortsRaw } = cohortIdsToFetch.length
    ? await supabase
        .from("cohorts")
        .select(
          "id, name, starts_at, ends_at, capstone_unlocks_at, consultant_user_id, organizations(id, name)",
        )
        .in("id", cohortIdsToFetch)
        .order("starts_at", { ascending: false, nullsFirst: false })
    : { data: [] };

  const cohorts = (cohortsRaw ?? []) as CohortRow[];

  if (cohorts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-brand-navy">No cohorts yet</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
            You'll see cohorts here once a LeadShift admin sets you as the consultant on one, or
            sets a per-learner override pointing to you.
          </p>
        </div>
      </div>
    );
  }

  // Figure out effective-consultant learners per cohort, and gather vitality.
  const { data: membersRaw } = await supabase
    .from("memberships")
    .select("user_id, cohort_id, role, consultant_user_id")
    .in(
      "cohort_id",
      cohorts.map((c) => c.id),
    )
    .eq("status", "active");

  const defaultByCohort = new Map(cohorts.map((c) => [c.id, c.consultant_user_id]));
  const myLearnersByCohort = new Map<string, string[]>();
  const coachesByCohort = new Map<string, number>();

  for (const m of membersRaw ?? []) {
    if (!m.cohort_id) continue;
    if (m.role === "coach") {
      coachesByCohort.set(m.cohort_id, (coachesByCohort.get(m.cohort_id) ?? 0) + 1);
    } else if (m.role === "learner") {
      const effective = m.consultant_user_id ?? defaultByCohort.get(m.cohort_id) ?? null;
      if (effective === user.id) {
        const list = myLearnersByCohort.get(m.cohort_id) ?? [];
        list.push(m.user_id);
        myLearnersByCohort.set(m.cohort_id, list);
      }
    }
  }

  const vitalityByCohort = new Map(
    await Promise.all(
      cohorts.map(async (c) => {
        const learnerIds = myLearnersByCohort.get(c.id) ?? [];
        const vit = await getCohortVitality(supabase, learnerIds, c.id);
        return [c.id, vit] as const;
      }),
    ),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-brand-navy">Your cohorts</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Program delivery — one card per cohort. Chips show where each cohort is right now.
        </p>
      </header>

      {/* Role explainer — compact, dismissible feel via <details>. Helps a
          new consultant understand what's theirs vs the coach's vs the
          learner's. */}
      <details className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
          What a consultant does (and doesn't)
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <span className="font-medium text-brand-navy">You see</span> every learner in cohorts
            you consult on — goals, actions, reflections, assessment summaries, coach session
            recaps, capstone — plus thought-partner activity titles (not transcripts; those stay
            private to the learner).
          </p>
          <p>
            <span className="font-medium text-brand-navy">You write</span> cohort-level decisions:
            assign coaches to learners, edit cohort metadata, nudge a learner's program experience.
          </p>
          <p>
            <span className="font-medium text-brand-navy">You don't</span> write coach notes or
            session recaps — that's the learner's executive coach. Your role is program delivery
            across the cohort.
          </p>
          <p className="text-xs text-neutral-500">
            A learner appears in your scope by <span className="font-medium">cohort default</span>{" "}
            (you're the consultant on their cohort) or by{" "}
            <span className="font-medium">per-learner override</span> (useful when one cohort spans
            multiple consultants). Both show up the same way on your dashboard.
          </p>
        </div>
      </details>

      <ul className="space-y-3">
        {cohorts.map((c) => {
          const learnerIds = myLearnersByCohort.get(c.id) ?? [];
          const vit = vitalityByCohort.get(c.id);
          const coaches = coachesByCohort.get(c.id) ?? 0;
          const isOverrideCohort = c.consultant_user_id !== user.id && learnerIds.length > 0;
          return (
            <li key={c.id}>
              <Link
                href={`/consultant/cohorts/${c.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/40 hover:bg-brand-light/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-500">
                      {c.organizations?.name ?? "Unknown org"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-brand-navy">{c.name}</h2>
                      {isOverrideCohort && (
                        <span
                          title="You consult on specific learners in this cohort via per-learner override"
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
                        >
                          Override
                        </span>
                      )}
                    </div>

                    {vit && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Stat
                          label="Learners"
                          value={vit.learnerCount}
                          detail={`${coaches} coach${coaches === 1 ? "" : "es"}`}
                        />
                        <Stat
                          label="Active 14d"
                          value={vit.activeLast14d}
                          detail={pctLabel(vit.activeLast14d, vit.learnerCount)}
                          tone={
                            vit.learnerCount === 0
                              ? "neutral"
                              : vit.activeLast14d / Math.max(1, vit.learnerCount) >= 0.7
                                ? "good"
                                : vit.activeLast14d / Math.max(1, vit.learnerCount) >= 0.4
                                  ? "okay"
                                  : "warn"
                          }
                        />
                        <Stat
                          label="Active sprint"
                          value={vit.withActiveSprint}
                          detail={pctLabel(vit.withActiveSprint, vit.learnerCount)}
                        />
                        <Stat
                          label="No coach"
                          value={vit.withoutCoach}
                          tone={vit.withoutCoach > 0 ? "warn" : "neutral"}
                        />
                        <Stat
                          label="Overdue"
                          value={vit.learnersOverdue}
                          tone={vit.learnersOverdue > 0 ? "warn" : "neutral"}
                        />
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                      {c.starts_at && <span>Starts {c.starts_at}</span>}
                      {c.ends_at && <span>Ends {c.ends_at}</span>}
                      {c.capstone_unlocks_at && (
                        <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 font-medium text-brand-pink">
                          Capstone unlocks {c.capstone_unlocks_at}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="mt-1 shrink-0 text-brand-blue">→</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({
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
    <div className="rounded-md border border-neutral-100 bg-neutral-50 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className={`text-lg font-bold ${toneClass}`}>{value}</span>
        {detail && <span className="text-[10px] text-neutral-500">{detail}</span>}
      </div>
    </div>
  );
}

function pctLabel(n: number, total: number): string {
  if (total === 0) return "";
  return `${Math.round((n / total) * 100)}%`;
}
