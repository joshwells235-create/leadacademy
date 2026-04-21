import { Panel } from "@/components/design/panel";

// The full-width program timeline at the bottom of the dashboard.
// A single horizontal rule with a pink→blue progress fill and a set
// of labeled milestone dots. The active milestone gets a slightly
// larger dot and an accent glow.
//
// Milestones are passed in as data rather than computed here — the
// parent derives them from cohort metadata + sprint history so the
// pass-through surfaces (coach learner detail, consultant learner
// detail, etc.) can reuse the component with their own milestone
// sets.
export type ArcMilestone = {
  /** Week number within the program (1-indexed). */
  week: number;
  label: string;
  /** Distinguishes the current phase dot (larger, glowing) from the
   *  plain markers. At most one should be active. */
  active?: boolean;
};

export function ArcStrip({
  programWeek,
  programTotal,
  capstoneDate,
  milestones,
}: {
  programWeek: number;
  programTotal: number;
  capstoneDate: string | null;
  milestones: ArcMilestone[];
}) {
  // Bail on the strip entirely if we don't have a real program length
  // to anchor it to. The strip is only meaningful when we can position
  // milestones against a known total.
  if (programTotal <= 0) return null;

  const pct = Math.max(0, Math.min(100, (programWeek / programTotal) * 100));

  return (
    <Panel>
      <div className="mb-5 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          The arc · {programTotal}-week program
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          Week {programWeek} / {programTotal}
          {capstoneDate && ` · Capstone ${formatShortDate(capstoneDate)}`}
        </p>
      </div>

      {/* Plot area: 38px tall. Horizontal rule at y=18, progress
          gradient from 0 to current week %, milestone dots positioned
          at their week %. */}
      <div className="relative h-[38px]">
        {/* Base rule — full width, thin, `rule` color. */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: 18,
            height: 1,
            background: "var(--t-rule)",
          }}
        />
        {/* Progress fill — pink → blue gradient, clipped to current %. */}
        <div
          className="absolute left-0"
          style={{
            top: 18,
            height: 1,
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--t-accent), var(--t-blue))",
          }}
        />
        {/* Milestone dots — labelled below. Active gets a bigger dot +
            glow so the learner's "you are here" reads at a glance. */}
        {milestones.map((m) => {
          const leftPct = Math.max(0, Math.min(100, (m.week / programTotal) * 100));
          const isActive = !!m.active;
          const size = isActive ? 12 : 6;
          return (
            <div
              key={`${m.week}-${m.label}`}
              className="absolute top-0 text-center"
              style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
            >
              <div
                className="mx-auto rounded-full"
                style={{
                  width: size,
                  height: size,
                  marginTop: 18 - size / 2,
                  background: isActive ? "var(--t-accent)" : "var(--t-ink-faint)",
                  boxShadow: isActive ? "0 0 16px var(--t-accent)" : "none",
                }}
                aria-hidden
              />
              <p
                className="mt-2 font-mono text-[9px] uppercase tracking-[0.15em]"
                style={{
                  color: isActive ? "var(--t-ink)" : "var(--t-ink-faint)",
                }}
              >
                {m.label}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}
