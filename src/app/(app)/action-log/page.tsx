import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionLogForm } from "./action-log-form";

type Props = { searchParams: Promise<{ goalId?: string }> };

export default async function ActionLogPage({ searchParams }: Props) {
  const { goalId: preselectedGoalId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [goalsRes, actionsRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, primary_lens, status")
      .eq("user_id", user!.id)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false }),
    supabase
      .from("action_logs")
      .select("id, description, reflection, impact_area, occurred_on, goal_id, goals(title, primary_lens)")
      .eq("user_id", user!.id)
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Action log</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Log what you actually did toward your goals. Small moves count — especially the ones that
          scared you a little.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {dates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
              <p className="text-sm text-neutral-600">
                Nothing logged yet. Use the form on the right to log your first action.
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
                        {a.goals && (
                          <Link
                            href={`/goals/${a.goal_id}`}
                            className="mt-2 inline-block text-xs text-neutral-500 hover:text-neutral-700"
                          >
                            → {a.goals.title}
                          </Link>
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
