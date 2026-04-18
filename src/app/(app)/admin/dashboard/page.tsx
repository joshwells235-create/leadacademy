import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get the admin's org.
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
  const orgId = mem?.org_id;
  if (!orgId) return <div className="p-8">No org found.</div>;

  // Org-wide stats.
  const [membersRes, goalsRes, actionsRes, reflectionsRes, assessmentsRes, cohortsRes] = await Promise.all([
    supabase.from("memberships").select("id, user_id, role, status, cohort_id, profiles:user_id(display_name)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("goals").select("id, user_id, status").eq("org_id", orgId).neq("status", "archived"),
    supabase.from("action_logs").select("id, user_id").eq("org_id", orgId).gte("occurred_on", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    supabase.from("reflections").select("id, user_id").eq("org_id", orgId).gte("reflected_on", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    supabase.from("assessments").select("user_id, assessment_documents(status)").eq("org_id", orgId),
    supabase.from("cohorts").select("id, name").eq("org_id", orgId),
  ]);

  const members = membersRes.data ?? [];
  const learners = members.filter((m) => m.role === "learner");
  const coaches = members.filter((m) => m.role === "coach" || m.role === "org_admin");
  const goals = goalsRes.data ?? [];
  const recentActions = actionsRes.data ?? [];
  const recentReflections = reflectionsRes.data ?? [];
  const assessments = assessmentsRes.data ?? [];
  const assessmentsComplete = assessments.filter((a) => {
    const docs = (a.assessment_documents ?? []) as Array<{ status: string }>;
    return docs.filter((d) => d.status === "ready").length >= 3;
  }).length;

  // Per-learner activity for the table.
  const learnerStats = learners.map((m) => {
    const uid = m.user_id;
    const name = (m.profiles as unknown as { display_name: string | null })?.display_name ?? "Unnamed";
    const goalCount = goals.filter((g) => g.user_id === uid).length;
    const actionCount = recentActions.filter((a) => a.user_id === uid).length;
    const reflectionCount = recentReflections.filter((r) => r.user_id === uid).length;
    const hasAssessments = assessments.some((a) => a.user_id === uid);
    return { uid, name, role: m.role, goalCount, actionCount, reflectionCount, hasAssessments };
  }).sort((a, b) => b.actionCount - a.actionCount);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="text-xl font-bold text-brand-navy mb-6">Program Overview</h2>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 mb-8">
        <Stat label="Members" value={members.length} />
        <Stat label="Learners" value={learners.length} />
        <Stat label="Coaches" value={coaches.length} />
        <Stat label="Active goals" value={goals.filter((g) => g.status === "in_progress").length} />
        <Stat label="Actions (7d)" value={recentActions.length} />
        <Stat label="Assessments done" value={`${assessmentsComplete}/${learners.length}`} />
      </div>

      {/* Per-learner activity table */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-brand-navy">Learner Activity (last 7 days)</h3>
        </div>
        {learnerStats.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-500">No learners in this org yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">Learner</th>
                <th className="text-center px-3 py-2 font-medium">Goals</th>
                <th className="text-center px-3 py-2 font-medium">Actions (7d)</th>
                <th className="text-center px-3 py-2 font-medium">Reflections (7d)</th>
                <th className="text-center px-3 py-2 font-medium">Assessments</th>
              </tr>
            </thead>
            <tbody>
              {learnerStats.map((l) => (
                <tr key={l.uid} className="border-b border-neutral-50 hover:bg-brand-light transition">
                  <td className="px-4 py-3 font-medium text-brand-navy">{l.name}</td>
                  <td className="text-center px-3 py-3">{l.goalCount}</td>
                  <td className="text-center px-3 py-3">
                    <span className={l.actionCount === 0 ? "text-neutral-400" : "text-brand-blue font-medium"}>{l.actionCount}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className={l.reflectionCount === 0 ? "text-neutral-400" : "text-brand-blue font-medium"}>{l.reflectionCount}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    {l.hasAssessments
                      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Uploaded</span>
                      : <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Not yet</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-brand-navy">{value}</div>
    </div>
  );
}
