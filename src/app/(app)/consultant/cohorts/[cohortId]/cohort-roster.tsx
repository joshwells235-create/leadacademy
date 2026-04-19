"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type RosterLearner = {
  userId: string;
  name: string;
  activeSprint: number;
  lastAction: string | null;
  capstoneStatus: string | null;
  coachName: string | null;
  isOverride: boolean;
  orgName: string | null;
};

type Sort = "activity" | "name" | "quiet" | "no-coach";
type Filter = "all" | "no-coach" | "quiet";

export function CohortRoster({
  learners,
  todayIso,
}: {
  learners: RosterLearner[];
  todayIso: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("activity");
  const [filter, setFilter] = useState<Filter>("all");

  const hasMultipleOrgs = useMemo(() => {
    const orgs = new Set(learners.map((l) => l.orgName ?? "—"));
    return orgs.size > 1;
  }, [learners]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = learners.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false;
      if (filter === "no-coach" && l.coachName) return false;
      if (filter === "quiet") {
        const days = daysSince(l.lastAction, todayIso);
        if (days != null && days < 14) return false;
      }
      return true;
    });
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "quiet") {
      list.sort((a, b) => {
        const da = daysSince(a.lastAction, todayIso) ?? 999;
        const db = daysSince(b.lastAction, todayIso) ?? 999;
        return db - da;
      });
    } else if (sort === "no-coach") {
      list.sort((a, b) => Number(!!a.coachName) - Number(!!b.coachName));
    } else {
      // activity: most recent action first, unassigned sinks last
      list.sort((a, b) => (b.lastAction ?? "").localeCompare(a.lastAction ?? ""));
    }
    return list;
  }, [learners, query, filter, sort, todayIso]);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-navy">
          Learners <span className="text-neutral-400">({learners.length})</span>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search learners by name"
            className="w-40 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-[11px] shadow-sm">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label="All" />
            <FilterPill
              active={filter === "no-coach"}
              onClick={() => setFilter("no-coach")}
              label="No coach"
            />
            <FilterPill
              active={filter === "quiet"}
              onClick={() => setFilter("quiet")}
              label="Quiet 14d+"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort roster"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="activity">Sort: most recent action</option>
            <option value="name">Sort: name</option>
            <option value="quiet">Sort: quietest first</option>
            <option value="no-coach">Sort: unassigned first</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500">No learners match.</p>
      ) : (
        <ul className="divide-y divide-neutral-50">
          {filtered.map((l) => {
            const days = daysSince(l.lastAction, todayIso);
            const isQuiet = days != null && days >= 14;
            return (
              <li key={l.userId}>
                <Link
                  href={`/consultant/learners/${l.userId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-brand-light/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-brand-navy">{l.name}</p>
                      {l.isOverride && (
                        <span
                          title="You consult on this learner via per-learner override"
                          className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
                        >
                          Override
                        </span>
                      )}
                      {hasMultipleOrgs && l.orgName && (
                        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
                          {l.orgName}
                        </span>
                      )}
                      {!l.coachName && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                          No coach
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                      <span>
                        {l.activeSprint > 0
                          ? `${l.activeSprint} active sprint`
                          : "No active sprint"}
                      </span>
                      <span className={isQuiet ? "font-medium text-amber-700" : ""}>
                        {l.lastAction ? `Last action ${l.lastAction}` : "No actions logged"}
                        {days != null && days >= 14 && <> · {days}d quiet</>}
                      </span>
                      {l.coachName && <span>Coach: {l.coachName}</span>}
                      {l.capstoneStatus && (
                        <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 font-medium text-brand-blue">
                          Capstone: {l.capstoneStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-brand-blue">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-medium transition ${
        active ? "bg-brand-blue text-white shadow-sm" : "text-neutral-600 hover:bg-brand-light"
      }`}
    >
      {label}
    </button>
  );
}

function daysSince(iso: string | null, todayIso: string): number | null {
  if (!iso) return null;
  const from = new Date(`${iso}T00:00:00Z`).getTime();
  const to = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}
