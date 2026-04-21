import Link from "next/link";
import type { PriorityItem, PriorityItemKind } from "@/lib/coach/caseload-pulse";

const MAX_SHOWN = 8;

/**
 * Ordered list of actionable items across the coach's caseload. Each row
 * links to the relevant learner's detail page so the coach can act.
 *
 * Shown below the caseload-pulse strip on Coaching Home. When the queue is
 * empty, renders an "all clear" state rather than an empty card — the
 * absence is a real signal.
 */
export function PriorityQueue({ items }: { items: PriorityItem[] }) {
  if (items.length === 0) {
    return (
      <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-emerald-800">Nothing urgent across your caseload</h2>
        <p className="mt-1 text-sm text-emerald-700/90">
          No flagged questions waiting, no overdue action items, no one gone quiet. Use the time to
          dig into a coachee's sprint or plan the week ahead.
        </p>
      </section>
    );
  }

  const shown = items.slice(0, MAX_SHOWN);
  const extra = items.length - shown.length;

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-bold text-brand-navy">
          Worth your attention this week
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          {items.length} item{items.length === 1 ? "" : "s"} across your caseload. Ordered by
          urgency.
        </p>
      </div>
      <ul className="divide-y divide-neutral-100">
        {shown.map((item) => (
          <li key={item.id}>
            <Link
              href={`/coach/learners/${item.learnerId}`}
              className="flex items-start gap-3 px-5 py-3 transition hover:bg-brand-light"
            >
              <KindIcon kind={item.kind} urgency={item.urgency} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-navy">{item.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{item.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-neutral-400 group-hover:text-brand-blue">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {extra > 0 && (
        <div className="border-t border-neutral-100 px-5 py-2 text-center text-xs text-neutral-500">
          {extra} more — scan the full caseload below.
        </div>
      )}
    </section>
  );
}

function KindIcon({ kind, urgency }: { kind: PriorityItemKind; urgency: PriorityItem["urgency"] }) {
  const bg =
    urgency === "high"
      ? "bg-brand-pink/10 text-brand-pink"
      : urgency === "medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-neutral-100 text-neutral-500";
  const glyph = GLYPH[kind];
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${bg}`}
    >
      {glyph}
    </span>
  );
}

const GLYPH: Record<PriorityItemKind, string> = {
  flagged_question: "?",
  overdue_action_items: "!",
  overdue_recap: "R",
  quiet_coachee: "·",
  new_assignment: "+",
};
