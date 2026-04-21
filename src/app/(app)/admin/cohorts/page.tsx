import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type CohortListRow, CohortManager } from "./cohort-manager";

export default async function CohortsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return <div className="p-8">No org.</div>;

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select(
      "id, name, description, starts_at, ends_at, capstone_unlocks_at, consultant_user_id, created_at",
    )
    .eq("org_id", mem.org_id)
    .order("starts_at", { ascending: false, nullsFirst: false });

  const cohortIds = (cohorts ?? []).map((c) => c.id);
  const consultantIds = Array.from(
    new Set((cohorts ?? []).map((c) => c.consultant_user_id).filter((id): id is string => !!id)),
  );

  const [membersRes, consultantsRes] = await Promise.all([
    cohortIds.length > 0
      ? supabase
          .from("memberships")
          .select("cohort_id")
          .in("cohort_id", cohortIds)
          .eq("status", "active")
      : { data: [] as { cohort_id: string }[] },
    consultantIds.length > 0
      ? supabase.from("profiles").select("user_id, display_name").in("user_id", consultantIds)
      : { data: [] as { user_id: string; display_name: string | null }[] },
  ]);

  const countByCohort = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    if (m.cohort_id) countByCohort.set(m.cohort_id, (countByCohort.get(m.cohort_id) ?? 0) + 1);
  }
  const consultantById = new Map(
    (consultantsRes.data ?? []).map((p) => [p.user_id, p.display_name] as const),
  );

  const rows: CohortListRow[] = (cohorts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    capstone_unlocks_at: c.capstone_unlocks_at,
    consultant_name: c.consultant_user_id
      ? (consultantById.get(c.consultant_user_id) ?? null)
      : null,
    memberCount: countByCohort.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h2 className="mb-1 text-xl font-bold text-brand-navy">Cohorts</h2>
      <p className="mb-6 text-sm text-neutral-600">
        Cohorts group learners moving through the program together. Click a cohort to see its roster
        + move learners between cohorts.
      </p>
      <CohortManager cohorts={rows} />
    </div>
  );
}
