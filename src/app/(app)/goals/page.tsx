import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Growth Goals — Leadership Academy" };

const LENS_LABEL: Record<string, string> = {
  self: "Leading Self",
  others: "Leading Others",
  org: "Leading the Organization",
};

type Props = {
  searchParams: Promise<{ status?: string }>;
};

export default async function GoalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const statusFilter: "active" | "completed" | "all" =
    sp.status === "completed" || sp.status === "all" ? sp.status : "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const goalsQuery = supabase
    .from("goals")
    .select(
      "id, primary_lens, title, status, target_date, smart_criteria, impact_self, impact_others, impact_org, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (statusFilter === "active") goalsQuery.in("status", ["not_started", "in_progress"]);
  else if (statusFilter === "completed") goalsQuery.eq("status", "completed");
  else goalsQuery.neq("status", "archived");

  const [goalsRes, actionCountsRes, activeSprintsRes] = await Promise.all([
    goalsQuery,
    supabase
      .from("action_logs")
      .select("goal_id, occurred_on")
      .eq("user_id", user.id)
      .not("goal_id", "is", null),
    supabase
      .from("goal_sprints")
      .select("goal_id, title, planned_end_date, action_count, created_at")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);
  const goals = goalsRes.data;

  // Per-goal action aggregates so each card can show momentum at a glance.
  const actionByGoal = new Map<string, { count: number; lastOccurredOn: string }>();
  for (const row of actionCountsRes.data ?? []) {
    if (!row.goal_id) continue;
    const existing = actionByGoal.get(row.goal_id);
    if (!existing) {
      actionByGoal.set(row.goal_id, { count: 1, lastOccurredOn: row.occurred_on });
    } else {
      existing.count += 1;
      if (row.occurred_on > existing.lastOccurredOn) existing.lastOccurredOn = row.occurred_on;
    }
  }
  const sprintByGoal = new Map<
    string,
    { title: string; planned_end_date: string; action_count: number; created_at: string }
  >();
  for (const s of activeSprintsRes.data ?? []) {
    if (s.goal_id) sprintByGoal.set(s.goal_id, s);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Goals
          </p>
          <h1
            className="mt-2 leading-[1.08] text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(32px, 4.5vw, 44px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            What you're growing into.
          </h1>
          <p className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-ink-soft">
            Every goal here is integrative — it changes you, the people
            around you, and the work at the organizational level. Click any
            goal to refine it, or start a new one with your thought partner.
          </p>
        </div>
        <Link
          href="/coach-chat?mode=goal"
          className="shrink-0 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          + Draft with thought partner
        </Link>
      </div>

      {/* Status filter — a button group so active state is visible at a glance. */}
      <div className="mb-4 inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm shadow-sm">
        <FilterPill href="/goals" active={statusFilter === "active"} label="Active" />
        <FilterPill
          href="/goals?status=completed"
          active={statusFilter === "completed"}
          label="Completed"
        />
        <FilterPill href="/goals?status=all" active={statusFilter === "all"} label="All" />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-500">Start fresh from a lens:</span>
        <Link
          href="/coach-chat?mode=goal&lens=self"
          className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-medium text-brand-blue hover:border-brand-blue/40 hover:bg-brand-blue/5"
        >
          Leading Self
        </Link>
        <Link
          href="/coach-chat?mode=goal&lens=others"
          className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-medium text-brand-blue hover:border-brand-blue/40 hover:bg-brand-blue/5"
        >
          Leading Others
        </Link>
        <Link
          href="/coach-chat?mode=goal&lens=org"
          className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-medium text-brand-blue hover:border-brand-blue/40 hover:bg-brand-blue/5"
        >
          Leading the Organization
        </Link>
      </div>

      {(!goals || goals.length === 0) && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          {statusFilter === "active" ? (
            <>
              <p className="font-serif text-lg font-semibold text-brand-navy">
                Nothing live yet.
              </p>
              <figure className="mt-4 max-w-md">
                <blockquote className="font-serif text-[15px] italic leading-[1.6] text-brand-navy/75">
                  "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
                </blockquote>
                <figcaption className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-brand-navy/45">
                  — Will Durant, on Aristotle
                </figcaption>
              </figure>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-navy/65">
                A goal here isn't a quarterly OKR. It's the thing you'd quietly like to be true
                about you in nine months — something practice gets you to, not a calendar.
              </p>
              <Link
                href="/coach-chat?mode=goal"
                className="mt-5 inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
              >
                Draft one with your thought partner →
              </Link>
            </>
          ) : statusFilter === "completed" ? (
            <p>Nothing completed yet — your finished goals will show up here.</p>
          ) : (
            <p>No goals to show.</p>
          )}
        </div>
      )}

      {goals && goals.length > 0 && (
        <ul className="space-y-3">
          {goals.map((g) => {
            const smart =
              g.smart_criteria && typeof g.smart_criteria === "object"
                ? (g.smart_criteria as Record<string, string>)
                : {};
            const actionStats = actionByGoal.get(g.id);
            const sprint = sprintByGoal.get(g.id);
            const sprintDay = sprint
              ? Math.min(
                  daysBetween(sprint.created_at.slice(0, 10), today) + 1,
                  Math.max(1, daysBetween(sprint.created_at.slice(0, 10), sprint.planned_end_date)),
                )
              : null;
            const sprintTotalDays = sprint
              ? Math.max(1, daysBetween(sprint.created_at.slice(0, 10), sprint.planned_end_date))
              : null;
            return (
              <li key={g.id}>
                <Link
                  href={`/goals/${g.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="font-semibold text-neutral-900">{g.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        {g.primary_lens && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                            started from {LENS_LABEL[g.primary_lens]}
                          </span>
                        )}
                        {g.target_date && <span>target {g.target_date}</span>}
                      </div>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>

                  {/* Momentum strip — visible at-a-glance progress a learner can feel. */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {sprint && sprintDay != null && sprintTotalDays != null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue/10 px-2 py-0.5 font-medium text-brand-blue">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
                        Sprint: {sprint.title} · day {sprintDay}/{sprintTotalDays}
                      </span>
                    ) : g.status === "in_progress" || g.status === "not_started" ? (
                      <span className="text-neutral-500">No active sprint</span>
                    ) : null}
                    <span className="text-neutral-600">
                      {actionStats ? (
                        <>
                          {actionStats.count} action{actionStats.count === 1 ? "" : "s"} logged
                          {actionStats.count > 0 && (
                            <span className="text-neutral-400">
                              {" "}
                              · last {formatShortDate(actionStats.lastOccurredOn, today)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-400">No actions logged yet</span>
                      )}
                    </span>
                  </div>

                  {smart.specific && (
                    <p className="mt-3 text-sm text-neutral-700">{smart.specific}</p>
                  )}

                  <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600 md:grid-cols-3">
                    <div>
                      <div className="font-medium uppercase tracking-wide text-neutral-500">
                        Self
                      </div>
                      <p className="mt-0.5 line-clamp-2">{g.impact_self}</p>
                    </div>
                    <div>
                      <div className="font-medium uppercase tracking-wide text-neutral-500">
                        Others
                      </div>
                      <p className="mt-0.5 line-clamp-2">{g.impact_others}</p>
                    </div>
                    <div>
                      <div className="font-medium uppercase tracking-wide text-neutral-500">
                        Org
                      </div>
                      <p className="mt-0.5 line-clamp-2">{g.impact_org}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-brand-blue text-white shadow-sm"
          : "text-neutral-600 hover:bg-brand-light hover:text-brand-navy"
      }`}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  const className =
    status === "completed"
      ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
      : status === "in_progress"
        ? "bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue/20"
        : status === "not_started"
          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
          : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

function formatShortDate(iso: string, today: string): string {
  if (iso === today) return "today";
  const diff = daysBetween(iso, today);
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  return iso.slice(5);
}
