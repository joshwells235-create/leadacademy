import { createClient } from "@/lib/supabase/server";
import { CohortManager } from "./cohort-manager";

export default async function CohortsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
  if (!mem) return <div className="p-8">No org.</div>;

  const { data: cohorts } = await supabase.from("cohorts").select("id, name, description, starts_at, ends_at, created_at").eq("org_id", mem.org_id).order("created_at", { ascending: false });

  // Get member counts per cohort.
  const cohortIds = (cohorts ?? []).map((c) => c.id);
  const { data: members } = cohortIds.length > 0
    ? await supabase.from("memberships").select("cohort_id").in("cohort_id", cohortIds).eq("status", "active")
    : { data: [] };

  const countByCoho: Record<string, number> = {};
  for (const m of members ?? []) {
    if (m.cohort_id) countByCoho[m.cohort_id] = (countByCoho[m.cohort_id] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h2 className="text-xl font-bold text-brand-navy mb-6">Cohorts</h2>
      <CohortManager cohorts={(cohorts ?? []).map((c) => ({ ...c, memberCount: countByCoho[c.id] ?? 0 }))} />
    </div>
  );
}
