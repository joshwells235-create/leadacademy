import Link from "next/link";
import { redirect } from "next/navigation";
import { getSinceLastSessionStats } from "@/lib/coach/since-last-session";
import { createClient } from "@/lib/supabase/server";
import { type LearnerCardData, LearnersGrid } from "./learners-grid";

export default async function CoachDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get all active learner assignments for this coach.
  const { data: assignments } = await supabase
    .from("coach_assignments")
    .select("learner_user_id, cohort_id, active_from, cohorts(name)")
    .eq("coach_user_id", user.id)
    .is("active_to", null);

  if (!assignments || assignments.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-brand-navy">Your learners</h1>
        <p className="mt-2 text-sm text-neutral-600">
          No learners assigned to you yet. Ask an admin to set up coach assignments.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-brand-blue hover:underline"
        >
          Back to your own dashboard
        </Link>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const learnerIds = assignments.map((a) => a.learner_user_id);

  // Parallel: profile lookups, goal counts, active sprints, pending/overdue
  // action items, latest prep per learner, plus per-learner "since last
  // session" stats.
  const [profilesRes, goalsRes, sprintsRes, itemsRes, preSessionRes, sinceStats] =
    await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", learnerIds),
      supabase
        .from("goals")
        .select("user_id, id")
        .in("user_id", learnerIds)
        .in("status", ["not_started", "in_progress"]),
      supabase
        .from("goal_sprints")
        .select("user_id, id")
        .in("user_id", learnerIds)
        .eq("status", "active"),
      supabase
        .from("action_items")
        .select("learner_user_id, id, due_date, completed")
        .in("learner_user_id", learnerIds)
        .eq("completed", false),
      supabase
        .from("pre_session_notes")
        .select("user_id, id, created_at")
        .in("user_id", learnerIds)
        .order("created_at", { ascending: false }),
      Promise.all(
        assignments.map((a) =>
          getSinceLastSessionStats(supabase, user.id, a.learner_user_id).then((stats) => ({
            learnerId: a.learner_user_id,
            stats,
          })),
        ),
      ),
    ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
  const sinceMap = new Map(sinceStats.map((s) => [s.learnerId, s.stats]));

  const learnerCards: LearnerCardData[] = assignments.map((a) => {
    const profile = profileMap.get(a.learner_user_id);
    const activeGoals = (goalsRes.data ?? []).filter((g) => g.user_id === a.learner_user_id).length;
    const activeSprints = (sprintsRes.data ?? []).filter(
      (s) => s.user_id === a.learner_user_id,
    ).length;
    const itemsForLearner = (itemsRes.data ?? []).filter(
      (i) => i.learner_user_id === a.learner_user_id,
    );
    const pendingItems = itemsForLearner.length;
    const overdueItems = itemsForLearner.filter((i) => i.due_date && i.due_date < today).length;
    const lastPrep = (preSessionRes.data ?? []).find((n) => n.user_id === a.learner_user_id);
    const stats = sinceMap.get(a.learner_user_id);

    return {
      learnerId: a.learner_user_id,
      name: profile?.display_name ?? "Unnamed learner",
      cohortName: a.cohorts?.name ?? null,
      activeFrom: a.active_from,
      activeGoals,
      activeSprints,
      pendingItems,
      overdueItems,
      lastPrepDate: lastPrep?.created_at ?? null,
      sinceLabel: stats
        ? stats.anchorFromRecap
          ? stats.daysSinceAnchor === 0
            ? "Since today's recap"
            : `Since your last recap (${stats.daysSinceAnchor}d)`
          : `Last ${stats.daysSinceAnchor || 14} days`
        : "",
      newActions: stats?.newActions ?? 0,
      newReflections: stats?.newReflections ?? 0,
      newPreSessionNotes: stats?.newPreSessionNotes ?? 0,
      newConversationActivity: stats?.newConversationActivity ?? 0,
      newCompletedActionItems: stats?.newCompletedActionItems ?? 0,
      flaggedQuestionsWaiting: stats?.flaggedQuestionsWaiting ?? 0,
      hasAnyNew: stats
        ? stats.newActions +
            stats.newReflections +
            stats.newPreSessionNotes +
            stats.newConversationActivity +
            stats.newCompletedActionItems +
            stats.flaggedQuestionsWaiting >
          0
        : false,
      daysSinceAnchor: stats?.daysSinceAnchor ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Your learners</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {assignments.length} learner{assignments.length === 1 ? "" : "s"} assigned. Chips show
            what's new since your last recap.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-600 hover:text-brand-blue">
          ← Your own dashboard
        </Link>
      </div>

      <LearnersGrid learners={learnerCards} />
    </div>
  );
}
