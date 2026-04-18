import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CoachDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get all active learner assignments for this coach.
  const { data: assignments } = await supabase
    .from("coach_assignments")
    .select("learner_user_id, cohort_id, cohorts(name)")
    .eq("coach_user_id", user!.id)
    .is("active_to", null);

  if (!assignments || assignments.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-brand-navy">Coach Portal</h1>
        <p className="mt-2 text-sm text-neutral-600">No learners assigned to you yet. Ask an admin to set up coach assignments.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-brand-blue underline">Back to dashboard</Link>
      </div>
    );
  }

  // Fetch learner profiles + stats in parallel.
  const learnerIds = assignments.map((a) => a.learner_user_id);
  const [profilesRes, goalsRes, actionsRes, itemsRes, preSessionRes] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name").in("user_id", learnerIds),
    supabase.from("goals").select("user_id, id").in("user_id", learnerIds).neq("status", "archived"),
    supabase.from("action_logs").select("user_id, id").in("user_id", learnerIds).gte("occurred_on", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    supabase.from("action_items").select("learner_user_id, id").in("learner_user_id", learnerIds).eq("completed", false),
    supabase.from("pre_session_notes").select("user_id, id, created_at").in("user_id", learnerIds).order("created_at", { ascending: false }),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
  const countBy = (arr: { user_id?: string; learner_user_id?: string }[] | null, id: string, field: "user_id" | "learner_user_id" = "user_id") =>
    (arr ?? []).filter((r) => (r as Record<string, string>)[field] === id).length;
  const latestPreSession = (id: string) => (preSessionRes.data ?? []).find((n) => n.user_id === id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Coach Portal</h1>
          <p className="mt-1 text-sm text-neutral-600">{assignments.length} learner{assignments.length === 1 ? "" : "s"} assigned to you.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-600 hover:text-brand-blue">← Learner view</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {assignments.map((a) => {
          const profile = profileMap.get(a.learner_user_id);
          const goalCount = countBy(goalsRes.data, a.learner_user_id);
          const actionCount = countBy(actionsRes.data, a.learner_user_id);
          const pendingItems = countBy(itemsRes.data, a.learner_user_id, "learner_user_id");
          const lastPrep = latestPreSession(a.learner_user_id);

          return (
            <Link
              key={a.learner_user_id}
              href={`/coach/learners/${a.learner_user_id}`}
              className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300"
            >
              <h2 className="font-semibold text-neutral-900">{profile?.display_name ?? "Unnamed learner"}</h2>
              {a.cohorts?.name && <p className="text-xs text-neutral-500">{a.cohorts.name}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600">
                <div><span className="font-medium text-neutral-800">{goalCount}</span> goals</div>
                <div><span className="font-medium text-neutral-800">{actionCount}</span> actions (7d)</div>
                <div><span className="font-medium text-neutral-800">{pendingItems}</span> pending items</div>
                <div>{lastPrep ? `Prepped ${new Date(lastPrep.created_at).toLocaleDateString()}` : "No prep yet"}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
