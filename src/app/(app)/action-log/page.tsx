import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionLogForm } from "./action-log-form";
export const metadata: Metadata = { title: "Action Log — Leadership Academy" };

type Props = { searchParams: Promise<{ goalId?: string }> };

export default async function ActionLogPage({ searchParams }: Props) {
  const { goalId: preselectedGoalId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [goalsRes, actionsRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, primary_lens, status")
      .eq("user_id", user.id)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false }),
    supabase
      .from("action_logs")
      .select(
        "id, description, reflection, impact_area, occurred_on, goal_id, sprint_id, goals(title, primary_lens), goal_sprints(sprint_number, title, status)",
      )
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const goals = goalsRes.data ?? [];
  const actions = actionsRes.data ?? [];

  // Group actions by date (YYYY-MM-DD).
  const byDate: Record<string, typeof actions> = {};
  for (const a of actions) {
    const d = a.occurred_on;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(a);
  }
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Action log
        </p>
        <h1
          className="mt-2 leading-[1.08] text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          What you actually did.
        </h1>
        <p className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-ink-soft">
          Small moves count — especially the ones that scared you a little.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {dates.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-brand-navy">
                Nothing logged yet.
              </h2>
              <figure className="mx-auto mt-5 max-w-md">
                <blockquote className="font-serif text-[17px] italic leading-[1.6] text-brand-navy/80">
                  "How we spend our days is, of course, how we spend our lives."
                </blockquote>
                <figcaption className="mt-2 text-[11px] uppercase tracking-[0.18em] text-brand-navy/50">
                  — Annie Dillard
                </figcaption>
              </figure>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-brand-navy/65">
                The hard conversation you actually had. The thing you didn't redo for them. The
                draft you let ship. Worth writing down.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {dates.map((date) => (
                <div key={date}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {formatDate(date)}
                  </h2>
                  <ul className="space-y-2">
                    {byDate[date].map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-neutral-900">{a.description}</p>
                          {a.impact_area && (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                              {a.impact_area}
                            </span>
                          )}
                        </div>
                        {(a.goals || a.goal_sprints) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {a.goals && (
                              <Link
                                href={`/goals/${a.goal_id}`}
                                className="text-neutral-500 hover:text-brand-blue"
                              >
                                → {a.goals.title}
                              </Link>
                            )}
                            {a.goal_sprints && (
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${
                                  a.goal_sprints.status === "active"
                                    ? "bg-brand-blue/10 text-brand-blue"
                                    : "bg-neutral-100 text-neutral-600"
                                }`}
                                title={`Sprint ${a.goal_sprints.sprint_number}: ${a.goal_sprints.title}`}
                              >
                                Sprint {a.goal_sprints.sprint_number}
                              </span>
                            )}
                          </div>
                        )}
                        {a.reflection && (
                          <p className="mt-2 text-xs italic text-neutral-600">{a.reflection}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Log an action</h2>
            <ActionLogForm
              goals={goals.map((g) => ({ id: g.id, title: g.title }))}
              preselectedGoalId={preselectedGoalId}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
