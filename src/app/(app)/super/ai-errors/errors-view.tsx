"use client";

import { useMemo, useState } from "react";

export type AiErrorRow = {
  id: string;
  feature: string;
  model: string | null;
  orgName: string | null;
  userName: string | null;
  userId: string | null;
  orgId: string | null;
  errorMessage: string;
  errorDetails: Record<string, unknown> | null;
  createdAt: string;
  conversationId: string | null;
};

export function AiErrorsView({ rows }: { rows: AiErrorRow[] }) {
  const [query, setQuery] = useState("");
  const [featureFilter, setFeatureFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const features = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.feature);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (featureFilter !== "all" && r.feature !== featureFilter) return false;
      if (q) {
        const hay =
          `${r.feature} ${r.errorMessage} ${r.model ?? ""} ${r.orgName ?? ""} ${r.userName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, featureFilter]);

  // Group by feature for count chips.
  const countByFeature = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) map[r.feature] = (map[r.feature] ?? 0) + 1;
    return map;
  }, [rows]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search error text, user, org, model"
          className="flex-1 min-w-[220px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={featureFilter}
          onChange={(e) => setFeatureFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by feature"
        >
          <option value="all">All features</option>
          {features.map((f) => (
            <option key={f} value={f}>
              {f} ({countByFeature[f]})
            </option>
          ))}
        </select>
        <div className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          {rows.length === 0
            ? "No AI errors recorded. (That's a good thing.)"
            : "No errors match those filters."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <li key={r.id} className="rounded-lg border border-red-200 bg-red-50/30 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-mono font-medium text-red-700">
                      {r.feature}
                    </span>
                    {r.model && (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                        {r.model}
                      </span>
                    )}
                    {r.userName && (
                      <span className="text-[11px] text-neutral-500">
                        {r.userName}
                        {r.orgName ? ` · ${r.orgName}` : ""}
                      </span>
                    )}
                    {!r.userName && r.orgName && (
                      <span className="text-[11px] text-neutral-500">{r.orgName}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-neutral-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-red-900 break-words">
                  {r.errorMessage}
                </p>
                {r.errorDetails && Object.keys(r.errorDetails).length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="text-[11px] text-brand-blue hover:underline"
                    >
                      {expanded ? "Hide details" : "Show details"}
                    </button>
                    {expanded && (
                      <pre className="mt-1 overflow-auto rounded bg-white px-2 py-1.5 text-[11px] text-neutral-700">
                        {JSON.stringify(r.errorDetails, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
