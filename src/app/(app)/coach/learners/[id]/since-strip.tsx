import {
  formatSinceLastSessionLabel,
  hasAnyNewActivity,
  type SinceLastSessionStats,
} from "@/lib/coach/since-last-session";

/**
 * Compact "what's new since your last session" strip rendered at the top
 * of a coach's learner detail. Answers "what should I look at first?"
 * before the coach scrolls through everything. Silent when nothing has
 * changed since the anchor — the absence is itself a useful signal.
 */
export function SinceStrip({ stats }: { stats: SinceLastSessionStats }) {
  const label = formatSinceLastSessionLabel(stats);

  if (!hasAnyNewActivity(stats)) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-2 text-xs text-neutral-500">
        <span className="font-medium text-neutral-600">{label}:</span> quiet — no new activity from
        this learner.
      </div>
    );
  }

  const chips: { label: string; tone: "blue" | "pink" | "emerald" | "amber" }[] = [];
  if (stats.newPreSessionNotes > 0) {
    chips.push({
      label: `${stats.newPreSessionNotes} new prep note${stats.newPreSessionNotes === 1 ? "" : "s"}`,
      tone: "pink",
    });
  }
  if (stats.newActions > 0) {
    chips.push({
      label: `${stats.newActions} action${stats.newActions === 1 ? "" : "s"}`,
      tone: "blue",
    });
  }
  if (stats.newReflections > 0) {
    chips.push({
      label: `${stats.newReflections} reflection${stats.newReflections === 1 ? "" : "s"}`,
      tone: "blue",
    });
  }
  if (stats.newCompletedActionItems > 0) {
    chips.push({
      label: `${stats.newCompletedActionItems} item${stats.newCompletedActionItems === 1 ? "" : "s"} completed`,
      tone: "emerald",
    });
  }
  if (stats.newConversationActivity > 0) {
    chips.push({
      label: `${stats.newConversationActivity} thought-partner conversation${stats.newConversationActivity === 1 ? "" : "s"}`,
      tone: "blue",
    });
  }
  if (stats.newNudges > 0) {
    chips.push({
      label: `${stats.newNudges} AI nudge${stats.newNudges === 1 ? "" : "s"}`,
      tone: "amber",
    });
  }

  return (
    <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-blue">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Chip key={c.label} tone={c.tone}>
            {c.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "blue" | "pink" | "emerald" | "amber";
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-white text-brand-blue ring-1 ring-brand-blue/20",
    pink: "bg-white text-brand-pink ring-1 ring-brand-pink/20",
    emerald: "bg-white text-emerald-700 ring-1 ring-emerald-200",
    amber: "bg-white text-amber-800 ring-1 ring-amber-200",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}
