"use client";

export type CoachLoadRow = {
  userId: string;
  name: string;
  learnerCount: number;
};

/**
 * Coach-load panel — at-a-glance view of how learners are distributed
 * across coaches. High counts get an amber chip so imbalance stands
 * out.
 */
export function CoachLoadPanel({ coaches }: { coaches: CoachLoadRow[] }) {
  const sorted = [...coaches].sort((a, b) => b.learnerCount - a.learnerCount);
  const max = Math.max(1, ...sorted.map((c) => c.learnerCount));

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-navy">Coach load</h3>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          Learners assigned per coach. Use the Coach filter in the table above to rebalance.
        </p>
      </div>
      <ul className="divide-y divide-neutral-50">
        {sorted.map((c) => {
          const overload = c.learnerCount >= 15;
          const pct = Math.round((c.learnerCount / max) * 100);
          return (
            <li key={c.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-48 shrink-0 truncate text-brand-navy">{c.name}</span>
              <div className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full transition-all ${overload ? "bg-amber-500" : "bg-brand-blue"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span
                className={`w-20 shrink-0 text-right text-xs font-medium tabular-nums ${overload ? "text-amber-700" : "text-neutral-700"}`}
              >
                {c.learnerCount} learner{c.learnerCount === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
