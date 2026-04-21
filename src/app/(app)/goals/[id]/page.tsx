import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachChat } from "@/components/chat/coach-chat";
import { AccentWord } from "@/components/design/accent-word";
import { Panel } from "@/components/design/panel";
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

// Goal Detail — reskinned to the editorial system. Preserves every
// functional sub-component (SprintSection with active/history + start,
// SMART criteria, 3-lens impact, action log, embedded CoachChat for
// goal-mode refinement). Only the shell chrome + surface treatment
// changes: back-link + eyebrow + serif hero, themed Panels around
// sub-sections, full-width body typography.
//
// The design prototype shows a simplified two-panel view (Active
// sprint + "What the TP sees"); we keep the embedded CoachChat here
// because refining goals with the thought partner in-place is the
// core use case, and routing to /coach-chat just to refine this same
// goal would break the learner's focus.
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

  // Split the title into a head + accent tail so the hero reads like
  // the prototype ("Stop being the safety net."). Falls back to a
  // single-word tail when the title is short.
  const { head, tail } = splitAccent(goal.title);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-10 lg:px-12 lg:py-12">
      <Link
        href="/dashboard"
        className="mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft transition hover:text-ink"
      >
        ← Today
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {goal.primary_lens && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              Current goal · {LENS_LABELS[goal.primary_lens] ?? goal.primary_lens}
            </p>
          )}
          <h1
            className="mt-3 leading-[1.05] text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(36px, 6vw, 64px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            {head} {tail && <AccentWord>{tail}</AccentWord>}
          </h1>
          {goal.target_date && (
            <p className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-ink-soft">
              Target: {goal.target_date}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GoalStatusForm goalId={goal.id} status={goal.status} />
          <DeleteGoalButton goalId={goal.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {/* SprintSection stays as-is — its internal UI hasn't been
              migrated to the new design language yet; Phase 7 sweep
              will flip it. Wrapping in Panel gives it a matching
              surface until then so it doesn't look stranded. */}
          <Panel>
            <SprintSection goalId={goal.id} sprints={sprints} />
          </Panel>

          <Panel>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              SMART criteria
            </p>
            <dl className="mt-4 space-y-4 text-sm">
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
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: "var(--t-blue)" }}
                    >
                      {letter}
                    </span>
                    <div className="min-w-0">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-[14.5px] leading-[1.55] text-ink">
                        {smart[key]}
                      </dd>
                    </div>
                  </div>
                ) : null,
              )}
            </dl>
          </Panel>

          <Panel>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              Impact across the three lenses
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-faint">
              Every goal lives across all three. If any feel thin, refine with your
              thought partner on the right.
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  Leading Self
                </dt>
                <dd className="mt-0.5 text-[14.5px] leading-[1.55] text-ink">
                  {goal.impact_self}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  Leading Others
                </dt>
                <dd className="mt-0.5 text-[14.5px] leading-[1.55] text-ink">
                  {goal.impact_others}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  Leading the Organization
                </dt>
                <dd className="mt-0.5 text-[14.5px] leading-[1.55] text-ink">
                  {goal.impact_org}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Recent actions toward this goal
              </p>
              <Link
                href={`/action-log?goalId=${goal.id}`}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft hover:text-accent"
              >
                Log an action →
              </Link>
            </div>
            {actions && actions.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {actions.map((a) => (
                  <li
                    key={a.id}
                    className="pl-3"
                    style={{ borderLeft: "2px solid var(--t-rule)" }}
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                      <span>{a.occurred_on}</span>
                      {a.goal_sprints && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background:
                              a.goal_sprints.status === "active"
                                ? "var(--t-accent-soft)"
                                : "var(--t-rule)",
                            color:
                              a.goal_sprints.status === "active"
                                ? "var(--t-accent)"
                                : "var(--t-ink-soft)",
                          }}
                        >
                          Sprint {a.goal_sprints.sprint_number}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[14px] leading-[1.5] text-ink">
                      {a.description}
                    </div>
                    {a.reflection && (
                      <div
                        className="mt-1 italic text-[13px] leading-[1.5] text-ink-soft"
                        style={{ fontFamily: "var(--font-italic)" }}
                      >
                        {a.reflection}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
                Nothing logged yet. Take one small action, then come back and log it.
              </p>
            )}
          </Panel>
        </div>

        <div>
          <div
            className="flex h-full min-h-[60vh] flex-col overflow-hidden"
            style={{
              background: "var(--t-paper)",
              border: "1px solid var(--t-rule)",
              borderRadius: "var(--t-radius-lg)",
              boxShadow: "var(--t-panel-shadow)",
            }}
          >
            <header
              className="px-6 py-5"
              style={{ borderBottom: "1px solid var(--t-rule)" }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Work on this goal
              </p>
              <p
                className="mt-1.5 leading-[1.2] text-ink"
                style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 400 }}
              >
                with your thought partner.
              </p>
            </header>
            <CoachChat
              mode="goal"
              goalContext={{
                primaryLens: (goal.primary_lens as "self" | "others" | "org" | null) ?? undefined,
                goalId: goal.id,
              }}
              placeholder="Ask your thought partner about this goal…"
              emptyHint={
                <p>
                  Think this goal needs sharpening? Ask your thought partner to poke at it.
                  They already know the current SMART criteria and your recent actions.
                </p>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Split the goal title's tail for the italic-accent treatment. For
// short titles (2 words or fewer) we push the whole thing into the
// head so we don't get a lonely accent word; otherwise we accent the
// last word. Preserves trailing punctuation on the tail.
function splitAccent(title: string): { head: string; tail: string } {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 3) return { head: title.trim(), tail: "" };
  const tail = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(" ");
  return { head, tail };
}
