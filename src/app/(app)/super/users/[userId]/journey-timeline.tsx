import Link from "next/link";

export type JourneyEvent = {
  kind: "page" | "action";
  label: string;
  detail?: string | null;
  at: string; // ISO
};

/**
 * Merged journey timeline for one user — page visits interleaved with
 * the actions they took. Built for super admins to follow a teammate's
 * path through the site (onboarding support). Grouped by day, newest
 * first.
 */
export function JourneyTimeline({
  events,
  actorName,
}: {
  events: JourneyEvent[];
  actorName: string;
}) {
  if (events.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-brand-navy">Journey & activity</h2>
        <p className="mt-2 text-sm text-neutral-500">
          No recorded activity yet. Page visits and actions will appear here as {actorName} moves
          through the site.
        </p>
      </section>
    );
  }

  // Group by calendar day.
  const groups: { day: string; items: JourneyEvent[] }[] = [];
  for (const e of events) {
    const day = new Date(e.at).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-navy">Journey &amp; activity</h2>
        <Link
          href="/super/activity"
          className="text-[11px] text-brand-blue hover:underline"
        >
          Full action log →
        </Link>
      </div>
      <p className="mb-4 text-[11px] text-neutral-500">
        Most recent {events.length} events — page visits (dot) and actions (▸), newest first.
      </p>

      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.day}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {g.day}
            </div>
            <ul className="space-y-1.5">
              {g.items.map((e, i) => (
                <li
                  key={`${e.at}-${i}`}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <span
                    className={`mt-1.5 shrink-0 ${
                      e.kind === "action" ? "text-brand-blue" : "text-neutral-300"
                    }`}
                    aria-hidden
                  >
                    {e.kind === "action" ? "▸" : "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={
                          e.kind === "action"
                            ? "font-medium text-brand-navy"
                            : "text-neutral-700"
                        }
                      >
                        {e.label}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {new Date(e.at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {e.detail && (
                      <p className="truncate text-[11px] text-neutral-500">{e.detail}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
