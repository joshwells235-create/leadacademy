import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DailyChallengeWidget } from "@/components/daily-challenge-widget";
import { ActionItemToggle } from "@/components/action-item-toggle";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileRes, membershipRes, goalsRes, actionsRes, convRes, reflectionsRes, assessmentDocsRes, actionItemsRes, preSessionRes] = await Promise.all([
    supabase.from("profiles").select("display_name, super_admin").eq("user_id", user!.id).maybeSingle(),
    supabase.from("memberships").select("role, organizations(name), cohorts(name)").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("goals").select("id, title, status").eq("user_id", user!.id).neq("status", "archived"),
    supabase.from("action_logs").select("id, description, occurred_on").eq("user_id", user!.id).order("occurred_on", { ascending: false }).limit(3),
    supabase.from("ai_conversations").select("id, mode, last_message_at").eq("user_id", user!.id).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("reflections").select("id").eq("user_id", user!.id),
    supabase.from("assessments").select("id, assessment_documents(type, status)").eq("user_id", user!.id).maybeSingle(),
    supabase.from("action_items").select("id, title, due_date, completed").eq("learner_user_id", user!.id).eq("completed", false).order("due_date", { ascending: true, nullsFirst: false }).limit(5),
    supabase.from("pre_session_notes").select("id, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const profile = profileRes.data;
  const membership = membershipRes.data;
  const goals = goalsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const firstName = profile?.display_name?.split(" ")[0] ?? user!.email?.split("@")[0] ?? "there";
  const totalGoals = goals.length;
  const inProgress = goals.filter((g) => g.status === "in_progress").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const assessmentDocs = (assessmentDocsRes.data?.assessment_documents ?? []) as Array<{ type: string; status: string }>;
  const assessmentsReady = assessmentDocs.filter((d) => d.status === "ready").length;
  const hasActionItems = (actionItemsRes.data ?? []).length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {membership ? (
            <>
              {membership.organizations?.name}
              {membership.cohorts?.name ? <> — {membership.cohorts.name}</> : null}
            </>
          ) : profile?.super_admin ? "LeadShift super-admin" : ""}
        </p>
      </div>

      {/* ── SECTION 1: What to do today ── */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Today</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DailyChallengeWidget />

          {/* Coach action items or coach CTA */}
          {hasActionItems ? (
            <div className="rounded-lg border border-brand-blue/20 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-brand-navy">From your coach</h3>
              <ul className="mt-3 space-y-2">
                {(actionItemsRes.data ?? []).map((item) => (
                  <ActionItemToggle key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-brand-navy">Talk to the coach</h3>
                <p className="mt-1 text-sm text-neutral-600">
                  {convRes.data
                    ? `Last session ${new Date(convRes.data.last_message_at ?? "").toLocaleDateString()}.`
                    : "Your AI coach knows your goals, reflections, and assessments."}{" "}
                  Ask anything.
                </p>
              </div>
              <Link href="/coach-chat" className="mt-3 self-start rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
                Open coach →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Your growth ── */}
      {totalGoals === 0 ? (
        <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-brand-navy">Set your first growth goal</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Chat with the coach to draft an integrative SMART goal — one that changes you, the people
            around you, and the work at the organizational level.
          </p>
          <Link href="/coach-chat?mode=goal" className="mt-4 inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
            Draft a goal with the coach →
          </Link>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Your growth</h2>
            <Link href="/goals" className="text-xs text-brand-blue hover:underline">View all goals →</Link>
          </div>
          <div className="grid gap-3 grid-cols-3">
            <StatCard label="In progress" value={inProgress} color="blue" />
            <StatCard label="Completed" value={completed} color="green" />
            <StatCard label="Total" value={totalGoals} color="neutral" />
          </div>
        </div>
      )}

      {/* ── SECTION 3: Quick access ── */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Quick access</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {/* Recent actions */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-brand-navy">Actions</h3>
              <Link href="/action-log" className="text-xs text-brand-blue hover:underline">Log →</Link>
            </div>
            {actions.length === 0 ? (
              <p className="text-xs text-neutral-500">No actions logged yet.</p>
            ) : (
              <ul className="space-y-1 text-xs text-neutral-700">
                {actions.map((a) => (
                  <li key={a.id} className="flex gap-1.5 truncate">
                    <span className="text-neutral-400 shrink-0">{a.occurred_on.slice(5)}</span>
                    <span className="truncate">{a.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Reflections */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-brand-navy">Reflections</h3>
              <Link href="/reflections" className="text-xs text-brand-blue hover:underline">Journal →</Link>
            </div>
            <p className="text-xs text-neutral-600">
              {(reflectionsRes.data?.length ?? 0) === 0
                ? "Start journaling — even one sentence counts."
                : `${reflectionsRes.data!.length} reflection${reflectionsRes.data!.length !== 1 ? "s" : ""} so far.`}
            </p>
          </div>

          {/* Learning */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-brand-navy">Learning</h3>
              <Link href="/learning" className="text-xs text-brand-blue hover:underline">Courses →</Link>
            </div>
            <p className="text-xs text-neutral-600">Continue your assigned courses and track your progress.</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Setup tasks (contextual — only show what needs attention) ── */}
      {(assessmentsReady < 3 || !preSessionRes.data) && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Setup</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {assessmentsReady < 3 && (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-brand-navy">Assessments</h3>
                <p className="mt-1 text-xs text-neutral-600">
                  {assessmentsReady === 0
                    ? "Upload your PI, EQ-i, and 360 reports to ground coaching in real data."
                    : `${assessmentsReady}/3 uploaded. Add the rest for a complete picture.`}
                </p>
                <Link href="/assessments" className="mt-2 inline-block text-xs text-brand-blue hover:underline">
                  {assessmentsReady === 0 ? "Upload assessments →" : "Continue uploading →"}
                </Link>
              </div>
            )}
            {!preSessionRes.data && (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-brand-navy">Pre-session prep</h3>
                <p className="mt-1 text-xs text-neutral-600">
                  Write prep notes before your next coaching session so your coach can hit the ground running.
                </p>
                <Link href="/pre-session" className="mt-2 inline-block text-xs text-brand-blue hover:underline">
                  Write prep notes →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "blue" | "green" | "neutral" }) {
  const colors = {
    blue: "border-brand-blue/20 text-brand-blue",
    green: "border-emerald-200 text-emerald-600",
    neutral: "border-neutral-200 text-brand-navy",
  };
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${colors[color]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${colors[color].split(" ").pop()}`}>{value}</div>
    </div>
  );
}
