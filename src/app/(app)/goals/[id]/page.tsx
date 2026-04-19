import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachChat } from "@/components/chat/coach-chat";
import { createClient } from "@/lib/supabase/server";
import { DeleteGoalButton } from "./delete-goal-button";
import { GoalStatusForm } from "./goal-status-form";
import { SprintSection } from "./sprint-section";

type Props = { params: Promise<{ id: string }> };

const LENS_LABELS: Record<string, string> = {
  self: "Leading Self",
  others: "Leading Others",
  org: "Leading the Organization",
};

export default async function GoalDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: goal } = await supabase.from("goals").select("*").eq("id", id).maybeSingle();

  if (!goal) notFound();

  const smart =
    goal.smart_criteria && typeof goal.smart_criteria === "object"
      ? (goal.smart_criteria as Record<string, string>)
      : {};

  const [{ data: actions }, { data: sprintsData }] = await Promise.all([
    supabase
      .from("action_logs")
      .select(
        "id, description, reflection, occurred_on, impact_area, sprint_id, goal_sprints(sprint_number, status)",
      )
      .eq("goal_id", id)
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("goal_sprints")
      .select(
        "id, sprint_number, title, practice, planned_end_date, actual_end_date, status, action_count, created_at",
      )
      .eq("goal_id", id)
      .eq("user_id", user.id)
      .order("sprint_number", { ascending: true }),
  ]);
  const sprints = sprintsData ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 text-xs text-neutral-500">
        <Link href="/goals" className="hover:text-brand-blue">
          ← All goals
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          {goal.primary_lens && (
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              started from {LENS_LABELS[goal.primary_lens] ?? goal.primary_lens}
            </div>
          )}
          <h1 className="mt-1 text-2xl font-bold text-brand-navy">{goal.title}</h1>
          {goal.target_date && (
            <p className="mt-1 text-sm text-neutral-500">Target: {goal.target_date}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GoalStatusForm goalId={goal.id} status={goal.status} />
          <DeleteGoalButton goalId={goal.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <SprintSection goalId={goal.id} sprints={sprints} />

          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">SMART criteria</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {(
                [
                  ["specific", "Specific", "S"],
                  ["measurable", "Measurable", "M"],
                  ["achievable", "Achievable", "A"],
                  ["relevant", "Relevant", "R"],
                  ["time_bound", "Time-bound", "T"],
                ] as const
              ).map(([key, label, letter]) =>
                smart[key] ? (
                  <div key={key} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue"
                    >
                      {letter}
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-neutral-800">{smart[key]}</dd>
                    </div>
                  </div>
                ) : null,
              )}
            </dl>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Impact across the three lenses</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Every goal lives across all three. If any of these feel thin, refine with your thought
              partner on the right.
            </p>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Leading Self
                </dt>
                <dd className="mt-0.5 text-neutral-800">{goal.impact_self}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Leading Others
                </dt>
                <dd className="mt-0.5 text-neutral-800">{goal.impact_others}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Leading the Organization
                </dt>
                <dd className="mt-0.5 text-neutral-800">{goal.impact_org}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent actions toward this goal</h2>
              <Link
                href={`/action-log?goalId=${goal.id}`}
                className="text-xs text-neutral-600 hover:text-brand-blue"
              >
                Log an action →
              </Link>
            </div>
            {actions && actions.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {actions.map((a) => (
                  <li key={a.id} className="border-l-2 border-neutral-200 pl-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span>{a.occurred_on}</span>
                      {a.goal_sprints && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            a.goal_sprints.status === "active"
                              ? "bg-brand-blue/10 text-brand-blue"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          Sprint {a.goal_sprints.sprint_number}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-800">{a.description}</div>
                    {a.reflection && (
                      <div className="mt-1 text-xs italic text-neutral-600">{a.reflection}</div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                Nothing logged yet against this goal. Take a small action, then come back and log
                it.
              </p>
            )}
          </section>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Work on this goal</h2>
            <span className="text-xs text-neutral-500">with your thought partner</span>
          </div>
          <CoachChat
            mode="goal"
            goalContext={{
              primaryLens: (goal.primary_lens as "self" | "others" | "org" | null) ?? undefined,
              goalId: goal.id,
            }}
            placeholder="Ask your thought partner about this goal…"
            emptyHint={
              <p>
                Think this goal needs sharpening? Ask your thought partner to poke at it. They
                already know the current SMART criteria and your recent actions.
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}
