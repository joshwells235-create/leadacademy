"use client";

import { useId, useState } from "react";

type Org = { id: string; name: string };

export type ExportCounts = Record<
  "members" | "goals" | "action_logs" | "reflections" | "ai_usage" | "lesson_progress",
  { total: number; byOrg: Record<string, number> }
>;

type ExportKey = keyof ExportCounts;

const EXPORTS: { key: ExportKey; label: string; description: string }[] = [
  {
    key: "members",
    label: "Members",
    description: "All members across orgs with roles and cohorts.",
  },
  {
    key: "goals",
    label: "Goals",
    description: "All goals with SMART criteria, impact statements, and status.",
  },
  {
    key: "action_logs",
    label: "Action Logs",
    description: "All logged actions with reflections and dates.",
  },
  {
    key: "reflections",
    label: "Reflections",
    description: "All reflections with themes.",
  },
  {
    key: "ai_usage",
    label: "AI Usage",
    description: "Daily AI usage rollups per user per model.",
  },
  {
    key: "lesson_progress",
    label: "Lesson Progress",
    description: "Course completion data per learner.",
  },
];

export function ExportButtons({ orgs, counts }: { orgs: Org[]; counts: ExportCounts }) {
  const [orgFilter, setOrgFilter] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const orgSelectId = useId();

  const countFor = (key: ExportKey): number => {
    const c = counts[key];
    if (!orgFilter) return c.total;
    return c.byOrg[orgFilter] ?? 0;
  };

  const handleExport = async (key: string) => {
    setDownloading(key);
    try {
      const params = new URLSearchParams({ type: key });
      if (orgFilter) params.set("orgId", orgFilter);
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) {
        alert("Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      const orgSlug = orgFilter ? `-${orgFilter.slice(0, 8)}` : "";
      a.download = `${key}${orgSlug}-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const orgName = orgFilter ? orgs.find((o) => o.id === orgFilter)?.name : null;

  return (
    <div>
      <div className="mb-6">
        <label htmlFor={orgSelectId} className="block text-sm font-medium text-brand-navy mb-1">
          Filter by organization (optional)
        </label>
        <select
          id={orgSelectId}
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="">All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {orgName && (
          <p className="mt-1 text-[11px] text-neutral-500">
            Row counts below reflect the selection: <strong>{orgName}</strong>.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {EXPORTS.map((ex) => {
          const rowCount = countFor(ex.key);
          return (
            <div
              key={ex.key}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-brand-navy">{ex.label}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    rowCount > 0
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                  title={`${rowCount.toLocaleString()} rows`}
                >
                  {rowCount.toLocaleString()} rows
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">{ex.description}</p>
              <button
                type="button"
                onClick={() => handleExport(ex.key)}
                disabled={downloading === ex.key || rowCount === 0}
                className="mt-3 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {downloading === ex.key
                  ? "Exporting..."
                  : rowCount === 0
                    ? "Nothing to export"
                    : "Download CSV"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
