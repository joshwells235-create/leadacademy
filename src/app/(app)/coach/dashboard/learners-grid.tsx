"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type LearnerCardData = {
  learnerId: string;
  name: string;
  cohortName: string | null;
  activeFrom: string | null;
  activeGoals: number;
  activeSprints: number;
  pendingItems: number;
  overdueItems: number;
  lastPrepDate: string | null;
  sinceLabel: string;
  newActions: number;
  newReflections: number;
  newPreSessionNotes: number;
  newConversationActivity: number;
  newCompletedActionItems: number;
  flaggedQuestionsWaiting: number;
  hasAnyNew: boolean;
  daysSinceAnchor: number;
};

type Sort = "activity" | "name" | "overdue";

export function LearnersGrid({ learners }: { learners: LearnerCardData[] }) {
  const [query, setQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string | "all">("all");
  const [sort, setSort] = useState<Sort>("activity");

  const cohorts = useMemo(() => {
    const set = new Set<string>();
    for (const l of learners) if (l.cohortName) set.add(l.cohortName);
    return Array.from(set).sort();
  }, [learners]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = learners.filter((l) => {
      if (cohortFilter !== "all" && l.cohortName !== cohortFilter) return false;
      if (q && !l.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "overdue") {
      list.sort((a, b) => b.overdueItems - a.overdueItems || b.pendingItems - a.pendingItems);
    } else {
      // activity: most new signals first, then most recent prep
      list.sort((a, b) => {
        const aScore =
          a.newActions + a.newReflections + a.newPreSessionNotes * 2 + a.newConversationActivity;
        const bScore =
          b.newActions + b.newReflections + b.newPreSessionNotes * 2 + b.newConversationActivity;
        if (bScore !== aScore) return bScore - aScore;
        return (b.lastPrepDate ?? "").localeCompare(a.lastPrepDate ?? "");
      });
    }
    return list;
  }, [learners, query, cohortFilter, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learners…"
          aria-label="Search learners by name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue sm:max-w-xs"
        />
        {cohorts.length > 1 && (
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            aria-label="Filter by cohort"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="all">All cohorts ({learners.length})</option>
            {cohorts.map((c) => (
              <option key={c} value={c}>
                {c} ({learners.filter((l) => l.cohortName === c).length})
              </option>
            ))}
          </select>
        )}
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-xs shadow-sm">
          <SortPill
            active={sort === "activity"}
            onClick={() => setSort("activity")}
            label="Most active"
          />
          <SortPill
            active={sort === "overdue"}
            onClick={() => setSort("overdue")}
            label="Overdue"
          />
          <SortPill active={sort === "name"} onClick={() => setSort("name")} label="Name" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          No learners match your filter.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <LearnerCard key={l.learnerId} learner={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortPill({
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
      className={`rounded px-2.5 py-1 font-medium transition ${
        active ? "bg-brand-blue text-white shadow-sm" : "text-neutral-600 hover:bg-brand-light"
      }`}
    >
      {label}
    </button>
  );
}

function LearnerCard({ learner: l }: { learner: LearnerCardData }) {
  const chips: { label: string; tone: "blue" | "pink" | "amber" | "emerald" }[] = [];
  if (l.newPreSessionNotes > 0) {
    chips.push({
      label: `New prep · ${l.newPreSessionNotes}`,
      tone: "pink",
    });
  }
  if (l.flaggedQuestionsWaiting > 0) {
    chips.push({
      label: `${l.flaggedQuestionsWaiting} flagged question${l.flaggedQuestionsWaiting === 1 ? "" : "s"}`,
      tone: "pink",
    });
  }
  if (l.newActions > 0) {
    chips.push({
      label: `${l.newActions} new action${l.newActions === 1 ? "" : "s"}`,
      tone: "blue",
    });
  }
  if (l.newReflections > 0) {
    chips.push({
      label: `${l.newReflections} reflection${l.newReflections === 1 ? "" : "s"}`,
      tone: "blue",
    });
  }
  if (l.newCompletedActionItems > 0) {
    chips.push({
      label: `${l.newCompletedActionItems} item${l.newCompletedActionItems === 1 ? "" : "s"} done`,
      tone: "emerald",
    });
  }
  if (l.overdueItems > 0) {
    chips.push({
      label: `${l.overdueItems} overdue`,
      tone: "amber",
    });
  }

  const assignmentAgeDays = l.activeFrom
    ? Math.floor((Date.now() - new Date(l.activeFrom).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isNewAssignment = assignmentAgeDays != null && assignmentAgeDays < 7;

  return (
    <Link
      href={`/coach/learners/${l.learnerId}`}
      className={`block rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md ${
        l.hasAnyNew ? "border-brand-blue/40" : "border-neutral-200 hover:border-brand-blue/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-neutral-900">{l.name}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {l.cohortName ?? "No cohort"}
            {assignmentAgeDays != null && (
              <span className="ml-1 text-neutral-400">
                · coaching since {formatDate(l.activeFrom)}
              </span>
            )}
          </p>
        </div>
        {isNewAssignment && (
          <span className="shrink-0 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-blue">
            New
          </span>
        )}
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {chips.map((c) => (
            <Chip key={c.label} tone={c.tone}>
              {c.label}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-neutral-400">{l.sinceLabel} — quiet so far</p>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {l.activeSprints > 0 ? (
            <>
              <span className="font-medium text-brand-blue">{l.activeSprints}</span> active sprint
              {l.activeSprints === 1 ? "" : "s"}
            </>
          ) : l.activeGoals > 0 ? (
            <>
              {l.activeGoals} goal{l.activeGoals === 1 ? "" : "s"} · no active sprint
            </>
          ) : (
            "No active goals"
          )}
        </span>
        <span>{l.pendingItems} pending</span>
      </div>
    </Link>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "blue" | "pink" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-brand-blue/10 text-brand-blue",
    pink: "bg-danger-light text-danger",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
