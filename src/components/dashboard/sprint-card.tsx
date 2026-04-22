"use client";

import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/design/panel";
import { LogMomentModal } from "./log-moment-modal";
import { SprintMilestoneModal } from "./sprint-milestone-modal";

// The learner's current practice, rendered as something they'd want to
// come back to. Mono eyebrow (Sprint 02 · <goal title>, clickable to
// the goal), serif sprint title, italic accent-bordered practice
// sentence, three Fraunces numbers (pauses, days, pace), and a 28-day
// heatmap of action-logged days.
//
// Variants:
//   • full (Overview mode): stats + heatmap + recent pauses + milestone + log buttons
//   • compact (Focus mode): stats + heatmap + log button only
//
// Heatmap colors:
//   • accent pink: day with at least one action logged
//   • ink-soft: past day, no action
//   • rule: future day (faint)
//
// Empty state: when the learner has no active sprint, we render a
// framed "start a sprint" nudge instead. Keep the empty state
// deliberately plain — no skeleton bars, no fake heatmap.
export function SprintCard({
  sprint,
  goal,
  actionDays,
  recentActions,
  sprintNumber,
  compact,
}: {
  sprint: {
    id: string;
    title: string;
    practice: string;
    plannedEndDate: string;
    actionCount: number;
    actionGoal: number;
    day: number;
    totalDays: number;
  } | null;
  goal: { id: string; title: string } | null;
  /** 0-indexed day offsets (within the sprint) that have ≥1 action. */
  actionDays: number[];
  /** Most recent 2 action-log rows for the "Recent pauses" footer. */
  recentActions: Array<{ id: string; occurredOn: string; description: string }>;
  sprintNumber: number | null;
  compact?: boolean;
}) {
  if (!sprint || !goal) {
    return (
      <Panel>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue">
          No active sprint
        </p>
        <p
          className="mt-3 leading-[1.2] text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 26 }}
        >
          Start a sprint to make a goal practicable.
        </p>
        <p className="mt-3 text-[13px] leading-[1.6] text-ink-soft">
          A sprint is a 4–8 week practice window with a specific behavior. Your
          thought partner can help you pick one.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/coach-chat?mode=goal"
            className="inline-flex items-center rounded-full px-4.5 py-2.5 text-[13px] font-medium text-white"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 4px 20px var(--t-accent-soft)",
            }}
          >
            Start one with your thought partner →
          </Link>
          <Link
            href="/goals"
            className="inline-flex items-center rounded-full border px-4.5 py-2.5 text-[13px] font-medium text-ink transition hover:opacity-90"
            style={{ borderColor: "var(--t-rule)" }}
          >
            See your goals
          </Link>
        </div>
      </Panel>
    );
  }

  const actionDaySet = new Set(actionDays);
  const paceLabel = derivePace(sprint);
  const [logOpen, setLogOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);

  return (
    <Panel>
      {/* Eyebrow: Sprint number + goal title, clickable to goal detail. */}
      <Link
        href={`/goals/${goal.id}`}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-blue hover:opacity-80"
      >
        Sprint {String(sprintNumber ?? 0).padStart(2, "0")} · {goal.title} →
      </Link>

      {/* Sprint title — the practice, stated as a noun phrase. */}
      <h3
        className="mt-2 leading-[1.15] text-ink"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 26, letterSpacing: "-0.01em" }}
      >
        {sprint.title}
      </h3>

      {/* Italic practice sentence with accent left-rule — "this is what
          you're doing differently this sprint." */}
      <p
        className="mt-2 italic text-ink-soft"
        style={{
          fontFamily: "var(--font-italic)",
          fontSize: 14,
          borderLeft: "2px solid var(--t-accent)",
          paddingLeft: 10,
        }}
      >
        {sprint.practice}
      </p>

      {/* Stat row — three Fraunces numbers. */}
      <div className="mt-5 flex items-baseline gap-7">
        <StatNumber
          value={sprint.actionCount}
          total={sprint.actionGoal}
          label="Pauses logged"
        />
        <StatNumber
          value={sprint.day}
          total={sprint.totalDays}
          label="Days in"
        />
        <div>
          <p
            className="text-accent"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: 34,
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            {paceLabel}
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Pace
          </p>
        </div>
      </div>

      {/* 28-day heatmap — one bar per day. */}
      <div className="mt-3.5 flex gap-[3px]">
        {Array.from({ length: sprint.totalDays }, (_, i) => {
          const isPast = i < sprint.day;
          const hasAction = isPast && actionDaySet.has(i);
          return (
            <div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: 22,
                background: hasAction
                  ? "var(--t-accent)"
                  : isPast
                    ? "var(--t-ink-soft)"
                    : "var(--t-rule)",
              }}
              aria-label={
                hasAction
                  ? `Day ${i + 1}: action logged`
                  : isPast
                    ? `Day ${i + 1}: no action`
                    : `Day ${i + 1}: future`
              }
            />
          );
        })}
      </div>

      {/* Recent pauses — overview only. Two most-recent actions, with
          their date in mono next to the body text. */}
      {!compact && recentActions.length > 0 && (
        <div
          className="mt-5 pt-4"
          style={{ borderTop: "1px solid var(--t-rule)" }}
        >
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Recent pauses
          </p>
          <ul className="space-y-2.5">
            {recentActions.slice(0, 2).map((a) => (
              <li key={a.id} className="flex gap-2.5 text-[13px] leading-[1.5]">
                <span className="w-[80px] shrink-0 pt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                  {formatShortDate(a.occurredOn)}
                </span>
                <span className="text-ink-soft">{a.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action row — log a moment + (overview only, with at least one
          logged action) milestone. The log-a-moment button is the
          signature CTA and always present. The milestone button is
          hidden entirely until the learner has logged at least one
          action — nothing useful to celebrate yet, so the affordance
          shouldn't advertise itself. Reappears as soon as the first
          moment lands. */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center rounded-full px-4.5 py-2.5 text-[13px] font-medium text-white transition"
          style={{
            background: "var(--t-accent)",
            boxShadow: "0 4px 20px var(--t-accent-soft)",
          }}
        >
          + Log a moment
        </button>
        {!compact && sprint.actionCount > 0 && (
          <button
            type="button"
            onClick={() => setMilestoneOpen(true)}
            className="inline-flex items-center rounded-full border px-4.5 py-2.5 text-[13px] font-medium text-ink transition hover:opacity-90"
            style={{ borderColor: "var(--t-rule)" }}
          >
            ◉ Milestone moment
          </button>
        )}
      </div>

      <LogMomentModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        goalId={goal.id}
        sprintNumber={sprintNumber}
        sprintActionCount={sprint.actionCount}
        sprintActionGoal={sprint.actionGoal}
        sprintDay={sprint.day}
        sprintTotalDays={sprint.totalDays}
      />
      {!compact && (
        <SprintMilestoneModal
          open={milestoneOpen}
          onClose={() => setMilestoneOpen(false)}
          sprintNumber={sprintNumber}
          actionCount={sprint.actionCount}
          practice={sprint.practice}
          goalTitle={goal.title}
          day={sprint.day}
          totalDays={sprint.totalDays}
        />
      )}
    </Panel>
  );
}

// Fraunces number + mono label. Extracted so the three stats match.
function StatNumber({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  return (
    <div>
      <p
        className="text-ink"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: 34,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {value}
        <span className="text-ink-faint" style={{ fontSize: 18 }}>
          {" "}
          / {total}
        </span>
      </p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
    </div>
  );
}

// Derive a one-word pace label. Compare the learner's current pauses
// against the pro-rata expectation given how far into the sprint they
// are. "+ahead" / "on pace" / "behind" — one word the learner reads
// without parsing numbers. Pink accent when ahead (celebration), soft
// ink otherwise.
function derivePace(sprint: {
  actionCount: number;
  actionGoal: number;
  day: number;
  totalDays: number;
}): string {
  if (sprint.totalDays <= 0) return "—";
  const expected = (sprint.actionGoal * sprint.day) / sprint.totalDays;
  const delta = sprint.actionCount - expected;
  if (delta >= 1) return "+ahead";
  if (delta <= -1) return "behind";
  return "on pace";
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}
