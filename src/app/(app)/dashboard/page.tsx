import type { Metadata } from "next";
import Link from "next/link";
import { ActionItemToggle } from "@/components/action-item-toggle";
import { DailyChallengeWidget } from "@/components/daily-challenge-widget";
import { CoachNudgeCard } from "@/components/dashboard/coach-nudge-card";
import { detectAndFireNudge } from "@/lib/ai/nudges/detect";
import { startIntakeSession } from "@/lib/intake/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Dashboard — Leadership Academy" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    profileRes,
    membershipRes,
    goalsRes,
    actionsRes,
    convRes,
    reflectionsRes,
    assessmentDocsRes,
    actionItemsRes,
    preSessionRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, super_admin, intake_completed_at")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(name), cohorts(name)")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, title, status")
      .eq("user_id", user!.id)
      .neq("status", "archived"),
    supabase
      .from("action_logs")
      .select("id, description, occurred_on")
      .eq("user_id", user!.id)
      .order("occurred_on", { ascending: false })
      .limit(3),
    supabase
      .from("ai_conversations")
      .select("id, mode, last_message_at")
      .eq("user_id", user!.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("reflections").select("id").eq("user_id", user!.id),
    supabase
      .from("assessments")
      .select("id, assessment_documents(type, status)")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("action_items")
      .select("id, title, due_date, completed")
      .eq("learner_user_id", user!.id)
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("pre_session_notes")
      .select("id, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const membership = membershipRes.data;
  const goals = goalsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const firstName = profile?.display_name?.split(" ")[0] ?? user!.email?.split("@")[0] ?? "there";
  const totalGoals = goals.length;
  const inProgress = goals.filter((g) => g.status === "in_progress").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const assessmentDocs = (assessmentDocsRes.data?.assessment_documents ?? []) as Array<{
    type: string;
    status: string;
  }>;
  const assessmentsReady = assessmentDocs.filter((d) => d.status === "ready").length;
  const hasActionItems = (actionItemsRes.data ?? []).length > 0;

  const isFirstTime = totalGoals === 0 && (reflectionsRes.data?.length ?? 0) === 0 && !convRes.data;

  // Run proactive nudge detection on dashboard visits (skip first-time — no
  // signal to nudge on). Respects `proactivity_enabled` and rate limits
  // inside the detector itself.
  if (!isFirstTime) {
    await detectAndFireNudge(supabase, user!.id);
  }

  // Load the most recent pending nudge (un-acted, un-dismissed) to render.
  const { data: pendingNudge } = await supabase
    .from("coach_nudges")
    .select("id, notification_id, notifications(title, body, link, read_at)")
    .eq("user_id", user!.id)
    .is("acted_at", null)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nudgeForCard = pendingNudge?.notifications
    ? {
        id: pendingNudge.id,
        title: (pendingNudge.notifications as unknown as { title: string }).title,
        body: (pendingNudge.notifications as unknown as { body: string }).body,
        link:
          (pendingNudge.notifications as unknown as { link: string | null }).link ??
          `/coach-chat/from-nudge/${pendingNudge.id}`,
      }
    : null;

  // Intake is pending when the learner has never completed it. Learners
  // who're not yet assigned to a real membership (super-admin staff,
  // unassigned newcomers) don't need it.
  const intakePending = membership && !profile?.intake_completed_at;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header — warmer for first time */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-navy">
          {isFirstTime ? `Welcome, ${firstName}` : `Hi, ${firstName}`}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {isFirstTime ? (
            "You're in the right place. Let's get started on your leadership growth."
          ) : membership ? (
            <>
              {membership.organizations?.name}
              {membership.cohorts?.name ? <> — {membership.cohorts.name}</> : null}
            </>
          ) : profile?.super_admin ? (
            "LeadShift super-admin"
          ) : (
            ""
          )}
        </p>
      </div>

      {/* ── FIRST TIME: Getting started steps. Suppressed while intake is pending — the
           intake is the very first thing a new learner should do, and the steps card
           overlaps with it (both pitch "start a conversation"). ── */}
      {isFirstTime && !intakePending && (
        <div className="mb-10 rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-white to-brand-blue-light/30 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-brand-navy mb-1">Your first steps</h2>
          <p className="text-sm text-neutral-600 mb-6">
            Complete these in any order — each takes about 5 minutes.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <StepCard
              number="1"
              title="Talk to your thought partner"
              description="Your AI thought partner is ready. Tell it what you're working on as a leader."
              href="/coach-chat"
              cta="Start a conversation"
              done={!!convRes.data}
            />
            <StepCard
              number="2"
              title="Set a growth goal"
              description="Draft a SMART goal that changes you, your team, and your organization."
              href="/coach-chat?mode=goal"
              cta="Draft a goal"
              done={totalGoals > 0}
            />
            <StepCard
              number="3"
              title="Upload your assessments"
              description="PI, EQ-i, and 360 reports ground your thought partner in your real data."
              href="/assessments"
              cta="Upload assessments"
              done={assessmentsReady > 0}
            />
          </div>
        </div>
      )}

      {/* ── Intake CTA — surfaces any time intake is pending (first-time or returning),
           so a freshly-reset learner or a new invitee always sees it. ── */}
      {intakePending && (
        <div className="mb-6 rounded-2xl border-2 border-brand-blue/30 bg-gradient-to-br from-brand-blue-light/30 to-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue">
                Before we dig in
              </p>
              <h2 className="mt-1 text-base font-bold text-brand-navy">
                Tell your thought partner about yourself
              </h2>
              <p className="mt-1 text-sm text-neutral-700">
                A quick conversation so every future exchange feels like it already knows you — your
                role, team, company, and anything else worth knowing. Takes about five minutes.
              </p>
            </div>
            <form action={startIntakeSession}>
              <button
                type="submit"
                className="shrink-0 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
              >
                Start intake →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Proactive message from the thought partner (when a nudge has fired) ── */}
      {!isFirstTime && nudgeForCard && <CoachNudgeCard nudge={nudgeForCard} />}

      {/* ── SECTION 1: What to do today (only after first time) ── */}
      {!isFirstTime && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
            Today
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <DailyChallengeWidget />

            {hasActionItems ? (
              <div className="rounded-xl border-2 border-brand-blue/20 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-brand-navy">From your coach</h3>
                <ul className="mt-3 space-y-2">
                  {(actionItemsRes.data ?? []).map((item) => (
                    <ActionItemToggle key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">
                    Talk to your thought partner
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {convRes.data
                      ? `Last session ${new Date(convRes.data.last_message_at ?? "").toLocaleDateString()}.`
                      : "Your thought partner knows your goals, reflections, and assessments."}{" "}
                    Ask anything.
                  </p>
                </div>
                <Link
                  href="/coach-chat"
                  className="mt-3 self-start rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark transition"
                >
                  Open thought partner →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 2: Your growth ── */}
      {totalGoals === 0 && !isFirstTime ? (
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-brand-navy">Set your first growth goal</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Chat with your thought partner to draft an integrative SMART goal — one that changes
            you, the people around you, and the work at the organizational level.
          </p>
          <Link
            href="/coach-chat?mode=goal"
            className="mt-4 inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark transition"
          >
            Draft a goal with your thought partner →
          </Link>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Your growth
            </h2>
            <Link href="/goals" className="text-xs text-brand-blue hover:underline">
              View all goals →
            </Link>
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
          Quick access
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {/* Recent actions */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-brand-navy">Actions</h3>
              <Link href="/action-log" className="text-xs text-brand-blue hover:underline">
                Log →
              </Link>
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
              <Link href="/reflections" className="text-xs text-brand-blue hover:underline">
                Journal →
              </Link>
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
              <Link href="/learning" className="text-xs text-brand-blue hover:underline">
                Courses →
              </Link>
            </div>
            <p className="text-xs text-neutral-600">
              Continue your assigned courses and track your progress.
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Setup tasks (contextual — only after first-time onboarding) ── */}
      {!isFirstTime && (assessmentsReady < 3 || !preSessionRes.data) && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
            Setup
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {assessmentsReady < 3 && (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-brand-navy">Assessments</h3>
                <p className="mt-1 text-xs text-neutral-600">
                  {assessmentsReady === 0
                    ? "Upload your PI, EQ-i, and 360 reports to ground coaching in real data."
                    : `${assessmentsReady}/3 uploaded. Add the rest for a complete picture.`}
                </p>
                <Link
                  href="/assessments"
                  className="mt-2 inline-block text-xs text-brand-blue hover:underline"
                >
                  {assessmentsReady === 0 ? "Upload assessments →" : "Continue uploading →"}
                </Link>
              </div>
            )}
            {!preSessionRes.data && (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-brand-navy">Pre-session prep</h3>
                <p className="mt-1 text-xs text-neutral-600">
                  Write prep notes before your next coaching session so your coach can hit the
                  ground running.
                </p>
                <Link
                  href="/pre-session"
                  className="mt-2 inline-block text-xs text-brand-blue hover:underline"
                >
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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "neutral";
}) {
  const colors = {
    blue: "border-brand-blue/20 text-brand-blue",
    green: "border-emerald-200 text-emerald-600",
    neutral: "border-neutral-200 text-brand-navy",
  };
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${colors[color]}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${colors[color].split(" ").pop()}`}>{value}</div>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  href,
  cta,
  done,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition ${done ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200 bg-white shadow-sm hover:shadow-md hover:border-brand-blue/30"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : "bg-brand-navy text-white"}`}
        >
          {done ? "✓" : number}
        </span>
        <h3 className={`text-sm font-bold ${done ? "text-emerald-700" : "text-brand-navy"}`}>
          {title}
        </h3>
      </div>
      <p className="text-xs text-neutral-600 mb-3">{description}</p>
      {!done ? (
        <Link
          href={href}
          className="inline-flex rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark transition"
        >
          {cta} →
        </Link>
      ) : (
        <span className="text-xs text-emerald-600 font-medium">Done</span>
      )}
    </div>
  );
}
