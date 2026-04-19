"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  memberCount: number;
  learnerCount: number;
  cohortCount: number;
  activeLast14d: number;
  aiSpendCents30d: number;
};

type SortKey = "name" | "members" | "active14d" | "spend";

export function OrgsList({ rows }: { rows: OrgRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "members") return b.memberCount - a.memberCount;
      if (sort === "active14d") return b.activeLast14d - a.activeLast14d;
      if (sort === "spend") return b.aiSpendCents30d - a.aiSpendCents30d;
      return 0;
    });
    return list;
  }, [rows, query, statusFilter, sort]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <h2 className="font-semibold text-brand-navy">No organizations yet</h2>
        <p className="mt-1 text-sm text-neutral-600">Create one to onboard your first client.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or slug"
          className="flex-1 min-w-[200px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by status"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All statuses</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Sort"
        >
          <option value="name">Sort: Name</option>
          <option value="members">Sort: Members</option>
          <option value="active14d">Sort: Active 14d</option>
          <option value="spend">Sort: AI spend 30d</option>
        </select>
        <div className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">No organizations match those filters.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => (
            <li key={o.id}>
              <Link
                href={`/super/orgs/${o.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand-blue/30 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-brand-navy truncate">{o.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span className="font-mono">/{o.slug}</span>
                      <span>
                        {o.memberCount} member{o.memberCount === 1 ? "" : "s"}
                      </span>
                      <span>
                        {o.learnerCount} learner{o.learnerCount === 1 ? "" : "s"}
                      </span>
                      <span>
                        {o.cohortCount} cohort{o.cohortCount === 1 ? "" : "s"}
                      </span>
                      <span>Created {new Date(o.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-brand-blue">
                        {o.activeLast14d} active (14d)
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                        ${(o.aiSpendCents30d / 100).toFixed(2)} AI spend (30d)
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
