import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Consultant — Leadership Academy" };

type CohortRow = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  capstone_unlocks_at: string | null;
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
        .select("id, name, starts_at, ends_at, capstone_unlocks_at, organizations(id, name)")
        .in("id", cohortIdsToFetch)
        .order("starts_at", { ascending: false, nullsFirst: false })
    : { data: [] };

  const cohorts = (cohortsRaw ?? []) as CohortRow[];

  if (cohorts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-brand-navy">No cohorts assigned yet</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
            You'll see your cohorts here once a LeadShift admin assigns you as the consultant on
            one.
          </p>
        </div>
      </div>
    );
  }

  // Member counts per cohort. For learners we count only those the current
  // user effectively consults on (override = me, or no override and cohort
  // default = me). Coaches show the total in the cohort.
  const cohortIds = cohorts.map((c) => c.id);
  const [membersRes, cohortDefaultsRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("cohort_id, role, consultant_user_id")
      .in("cohort_id", cohortIds)
      .eq("status", "active"),
    supabase.from("cohorts").select("id, consultant_user_id").in("id", cohortIds),
  ]);

  const defaultByCohort = new Map<string, string | null>();
  for (const c of cohortDefaultsRes.data ?? []) {
    defaultByCohort.set(c.id, c.consultant_user_id);
  }

  const countsByCohort = new Map<string, { myLearners: number; coaches: number }>();
  for (const m of membersRes.data ?? []) {
    if (!m.cohort_id) continue;
    const current = countsByCohort.get(m.cohort_id) ?? { myLearners: 0, coaches: 0 };
    if (m.role === "coach") current.coaches += 1;
    if (m.role === "learner") {
      const effectiveConsultant = m.consultant_user_id ?? defaultByCohort.get(m.cohort_id) ?? null;
      if (effectiveConsultant === user.id) current.myLearners += 1;
    }
    countsByCohort.set(m.cohort_id, current);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Your cohorts</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Program delivery surface — one line per cohort you consult on.
        </p>
      </header>

      <ul className="space-y-3">
        {cohorts.map((c) => {
          const counts = countsByCohort.get(c.id) ?? { myLearners: 0, coaches: 0 };
          return (
            <li key={c.id}>
              <Link
                href={`/consultant/cohorts/${c.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/40 hover:bg-brand-light/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">
                      {c.organizations?.name ?? "Unknown org"}
                    </p>
                    <h2 className="mt-0.5 text-base font-semibold text-brand-navy">{c.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
                      <span>
                        {counts.myLearners} learner{counts.myLearners === 1 ? "" : "s"} you consult
                        on
                      </span>
                      <span>
                        {counts.coaches} coach{counts.coaches === 1 ? "" : "es"}
                      </span>
                      {c.starts_at && <span>Starts {c.starts_at}</span>}
                      {c.ends_at && <span>Ends {c.ends_at}</span>}
                      {c.capstone_unlocks_at && (
                        <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 text-[10px] font-medium text-brand-pink">
                          Capstone unlocks {c.capstone_unlocks_at}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-brand-blue">→</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
