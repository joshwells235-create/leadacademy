import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCapstoneGate } from "@/lib/capstone/gate";
import { createClient } from "@/lib/supabase/server";
import { CapstoneWorkspace } from "./capstone-workspace";

export const metadata: Metadata = { title: "Capstone — Leadership Academy" };

export default async function CapstonePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gate = await getCapstoneGate(supabase, user.id);

  if (gate.state === "no_membership" || gate.state === "no_cohort") {
    return (
      <LockedState
        title="Capstone builder"
        message="Your cohort isn't set up yet. Once your cohort is configured, the capstone builder will appear here."
      />
    );
  }

  if (gate.state === "not_scheduled") {
    return (
      <LockedState
        title="Capstone builder — coming later"
        message={`Your cohort ${gate.cohortName} doesn't have a capstone date scheduled yet. The builder opens up later in the program, after you've built enough of a journey to synthesize.`}
        prepHint
      />
    );
  }

  if (gate.state === "locked") {
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(`${gate.unlocksAt}T00:00:00Z`).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
    return (
      <LockedState
        title="Capstone — unlocks soon"
        message={`Opens on ${formatFullDate(gate.unlocksAt)}${
          daysRemaining === 0
            ? " — today."
            : daysRemaining === 1
              ? " — tomorrow."
              : `, ${daysRemaining} days from now.`
        } Between now and then, every goal, sprint, action, and reflection you log becomes raw material for the story you'll tell.`}
        unlockDate={gate.unlocksAt}
        daysRemaining={daysRemaining}
        prepHint
      />
    );
  }

  // Unlocked — load the outline + raw data we'll use to compute specific,
  // editorial stats. We intentionally fetch full reflection content (not just
  // counts) so we can surface the longest one and the most-returned-to theme.
  // Goals and actions are counted + first-seen for the "journey duration" stat.
  const [outlineRes, goalsRes, actionsRes, reflectionsRes] = await Promise.all([
    supabase
      .from("capstone_outlines")
      .select("id, outline, status, shared_at, finalized_at, conversation_id, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("action_logs")
      .select("id, occurred_on")
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: true }),
    supabase
      .from("reflections")
      .select("id, content, themes, reflected_on")
      .eq("user_id", user.id)
      .order("reflected_on", { ascending: true }),
  ]);

  const outline = outlineRes.data;
  const stats = computeCapstoneStats({
    goals: goalsRes.data ?? [],
    actions: actionsRes.data ?? [],
    reflections: reflectionsRes.data ?? [],
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="rounded-xl bg-brand-navy px-8 py-10 text-white shadow-sm">
        <p className="section-mark text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Nine months, one story
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight">
          Capstone
        </h1>
        <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-white/85">
          Your capstone is the ten-to-fifteen minute story you'll tell your stakeholders about who
          you've become as a leader over the last nine months. Your thought partner will help you
          synthesize your goals, sprints, actions, and reflections into an arc — but the story, and
          the presentation, are yours.
        </p>
      </header>

      {/* ── The raw material, in editorial prose.
           We used to render three generic stat cards here (goals / actions /
           reflections). Every premium LMS has the same three cards. This
           replaces them with specifics the learner can feel: their longest
           reflection, the theme they returned to most, how many days the
           practice has been underway. Costly to compute. Impossible to fake. */}
      {stats.hasAnything && (
        <section className="mt-8 rounded-xl border border-neutral-200 bg-white px-8 py-7 shadow-sm">
          <p className="section-mark text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            The raw material
          </p>
          <p className="mt-3 font-serif text-[17px] leading-[1.7] text-brand-navy/85">
            {renderStatsProse(stats)}
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-neutral-500">
            {stats.goalCount > 0 && (
              <Link href="/goals?status=all" className="hover:text-brand-blue">
                {stats.goalCount} {stats.goalCount === 1 ? "goal" : "goals"} →
              </Link>
            )}
            {stats.actionCount > 0 && (
              <Link href="/action-log" className="hover:text-brand-blue">
                {stats.actionCount} {stats.actionCount === 1 ? "action" : "actions"} →
              </Link>
            )}
            {stats.reflectionCount > 0 && (
              <Link href="/reflections" className="hover:text-brand-blue">
                {stats.reflectionCount}{" "}
                {stats.reflectionCount === 1 ? "reflection" : "reflections"} →
              </Link>
            )}
          </div>
        </section>
      )}

      <CapstoneWorkspace outline={outline ?? null} cohortName={gate.cohortName} />
    </div>
  );
}

function LockedState({
  title,
  message,
  prepHint,
  unlockDate,
  daysRemaining,
}: {
  title: string;
  message: string;
  prepHint?: boolean;
  unlockDate?: string;
  daysRemaining?: number;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-light">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand-navy"
              aria-hidden
            >
              <title>Locked</title>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-brand-navy">
              {title}
            </h1>
            {unlockDate && daysRemaining != null && daysRemaining > 0 && (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
                {daysRemaining} {daysRemaining === 1 ? "day" : "days"} to go
              </p>
            )}
            <p className="mt-3 font-serif text-[15px] leading-[1.7] text-brand-navy/75">
              {message}
            </p>
          </div>
        </div>

        {prepHint && (
          <div className="mt-6 border-t border-neutral-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Keep building the raw material
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <PrepLink
                href="/goals"
                title="Goals & sprints"
                hint="Each active sprint is a chapter"
              />
              <PrepLink href="/action-log" title="Action log" hint="Small moves become Evidence" />
              <PrepLink
                href="/reflections"
                title="Reflections"
                hint="Patterns become Shift beats"
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-brand-blue">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function PrepLink({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-neutral-200 bg-white p-3 transition hover:border-brand-blue/40 hover:shadow-sm"
    >
      <p className="text-sm font-semibold text-brand-navy">{title} →</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>
    </Link>
  );
}

// ── Capstone stats: the specifics that make a learner's own journey visible.
// Peers render generic counts. We compute the single longest reflection, the
// most-returned-to theme, and the total days the practice has been underway,
// then render them as prose the learner can feel.

type CapstoneStats = {
  hasAnything: boolean;
  goalCount: number;
  actionCount: number;
  reflectionCount: number;
  daysUnderway: number | null;
  firstDate: string | null; // ISO date of earliest artifact (goal / action / reflection)
  longestReflection: { wordCount: number; dateLabel: string } | null;
  topTheme: { name: string; count: number } | null;
};

function computeCapstoneStats(input: {
  goals: Array<{ created_at: string }>;
  actions: Array<{ occurred_on: string }>;
  reflections: Array<{ content: string; themes: string[] | null; reflected_on: string }>;
}): CapstoneStats {
  const goalCount = input.goals.length;
  const actionCount = input.actions.length;
  const reflectionCount = input.reflections.length;

  // Earliest artifact date tells us how long the practice has been underway.
  const firstDates = [
    input.goals[0]?.created_at?.slice(0, 10),
    input.actions[0]?.occurred_on,
    input.reflections[0]?.reflected_on,
  ].filter((d): d is string => Boolean(d));
  firstDates.sort();
  const firstDate = firstDates[0] ?? null;
  const daysUnderway = firstDate
    ? Math.max(0, Math.floor((Date.now() - new Date(firstDate).getTime()) / 86400000))
    : null;

  // Longest reflection — by word count. Quick demo-worthy specific.
  let longestReflection: CapstoneStats["longestReflection"] = null;
  for (const r of input.reflections) {
    const words = r.content.trim().split(/\s+/).filter(Boolean).length;
    if (!longestReflection || words > longestReflection.wordCount) {
      longestReflection = {
        wordCount: words,
        dateLabel: new Date(`${r.reflected_on}T00:00:00Z`).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }),
      };
    }
  }

  // Most-returned-to theme across all reflection.themes arrays.
  const themeCounts = new Map<string, number>();
  for (const r of input.reflections) {
    for (const t of r.themes ?? []) {
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
  }
  let topTheme: CapstoneStats["topTheme"] = null;
  for (const [name, count] of themeCounts) {
    if (count >= 2 && (!topTheme || count > topTheme.count)) {
      topTheme = { name, count };
    }
  }

  return {
    hasAnything: goalCount + actionCount + reflectionCount > 0,
    goalCount,
    actionCount,
    reflectionCount,
    daysUnderway,
    firstDate,
    longestReflection,
    topTheme,
  };
}

function renderStatsProse(s: CapstoneStats): string {
  // Compose the prose from whatever we have. Skip any sentence that would
  // surface a zero or a nothing — the point is specificity, not completeness.
  const parts: string[] = [];

  if (s.daysUnderway !== null && s.daysUnderway > 7) {
    const months = Math.round(s.daysUnderway / 30);
    const lead =
      months >= 2
        ? `Over ${months} months`
        : `Over ${s.daysUnderway} ${s.daysUnderway === 1 ? "day" : "days"}`;
    parts.push(
      `${lead} you've written ${s.reflectionCount} ${
        s.reflectionCount === 1 ? "reflection" : "reflections"
      } and logged ${s.actionCount} ${s.actionCount === 1 ? "action" : "actions"}.`,
    );
  } else if (s.reflectionCount > 0 || s.actionCount > 0) {
    parts.push(
      `So far: ${s.reflectionCount} ${
        s.reflectionCount === 1 ? "reflection" : "reflections"
      } and ${s.actionCount} ${s.actionCount === 1 ? "action" : "actions"}.`,
    );
  }

  if (s.longestReflection && s.longestReflection.wordCount >= 80) {
    parts.push(
      `Your longest reflection ran ${s.longestReflection.wordCount} words, on ${s.longestReflection.dateLabel}.`,
    );
  }

  if (s.topTheme) {
    parts.push(
      `You've returned to "${s.topTheme.name}" ${s.topTheme.count} times — more than any other thread.`,
    );
  }

  if (parts.length === 0) {
    return "Your capstone is built from what you've been doing all along. As goals, actions, and reflections accumulate, specifics for your arc will surface here.";
  }

  return parts.join(" ");
}

function formatFullDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
