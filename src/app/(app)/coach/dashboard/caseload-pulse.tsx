import type { CaseloadPulse as Pulse } from "@/lib/coach/caseload-pulse";

/**
 * Compact five-metric strip shown at the top of Coaching Home. Server
 * component — no interactivity. Numbers come from `getCaseloadPulse`.
 *
 * Colors follow the pattern:
 *   neutral for baseline counts (active, active-sprint)
 *   amber for "worth a look" signals (quiet, overdue recap)
 *   pink for "act on this now" signals (flagged, overdue items)
 */
export function CaseloadPulseStrip({ pulse }: { pulse: Pulse }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
      <Metric label="Active" value={pulse.activeCoachees} tone="neutral" />
      <Metric
        label="On a sprint"
        value={pulse.withActiveSprint}
        tone="neutral"
        suffix={`/ ${pulse.activeCoachees}`}
      />
      <Metric
        label="Flagged Q's"
        value={pulse.flaggedQuestionsWaiting}
        tone={pulse.flaggedQuestionsWaiting > 0 ? "pink" : "neutral"}
      />
      <Metric
        label="Overdue items"
        value={pulse.overdueActionItems}
        tone={pulse.overdueActionItems > 0 ? "pink" : "neutral"}
      />
      <Metric
        label="Quiet 14d+"
        value={pulse.quietCount}
        tone={pulse.quietCount > 0 ? "amber" : "neutral"}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "neutral" | "amber" | "pink";
}) {
  const toneClass =
    tone === "pink"
      ? "text-brand-pink"
      : tone === "amber"
        ? "text-amber-700"
        : "text-brand-navy";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</span>
        {suffix && <span className="text-xs text-neutral-400 tabular-nums">{suffix}</span>}
      </span>
    </div>
  );
}
