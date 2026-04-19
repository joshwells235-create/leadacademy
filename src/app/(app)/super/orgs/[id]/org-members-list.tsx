"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { labelForRole, roleBadgeClass } from "@/lib/admin/roles";

export type OrgMemberRow = {
  membershipId: string;
  userId: string;
  name: string;
  role: string;
  status: string;
  cohortId: string | null;
  cohortName: string | null;
};

type CohortOption = { id: string; name: string };

export function OrgMembersList({
  orgId,
  rows,
  cohorts,
}: {
  orgId: string;
  rows: OrgMemberRow[];
  cohorts: CohortOption[];
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [sort, setSort] = useState<"name" | "role" | "cohort">("name");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (cohortFilter === "none" && r.cohortId) return false;
      if (cohortFilter !== "all" && cohortFilter !== "none" && r.cohortId !== cohortFilter)
        return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "role") {
        const roleCmp = a.role.localeCompare(b.role);
        if (roleCmp !== 0) return roleCmp;
        return a.name.localeCompare(b.name);
      }
      if (sort === "cohort") {
        const ac = a.cohortName ?? "~";
        const bc = b.cohortName ?? "~";
        const c = ac.localeCompare(bc);
        if (c !== 0) return c;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [rows, query, roleFilter, cohortFilter, statusFilter, sort]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-brand-navy">
          Members ({filtered.length} of {rows.length})
        </h2>
      </div>

      <div className="px-4 py-3 border-b border-neutral-100 space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="learner">Learners</option>
            <option value="coach">Coaches</option>
            <option value="org_admin">Org Admins</option>
            <option value="consultant">Consultants</option>
          </select>
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            aria-label="Filter by cohort"
          >
            <option value="all">All cohorts</option>
            <option value="none">No cohort</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            aria-label="Filter by status"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="ml-auto rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            aria-label="Sort"
          >
            <option value="name">Sort: Name</option>
            <option value="role">Sort: Role</option>
            <option value="cohort">Sort: Cohort</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-neutral-500">
          No members match those filters.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-50 max-h-[600px] overflow-auto">
          {filtered.map((m) => (
            <li
              key={m.membershipId}
              className="px-4 py-3 flex items-center justify-between hover:bg-brand-light transition"
            >
              <div className="min-w-0">
                <Link
                  href={`/super/orgs/${orgId}/members/${m.userId}`}
                  className="text-sm font-medium text-brand-navy hover:text-brand-blue"
                >
                  {m.name}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBadgeClass(m.role)}`}
                  >
                    {labelForRole(m.role)}
                  </span>
                  {m.cohortName && (
                    <span className="text-[10px] text-neutral-400">{m.cohortName}</span>
                  )}
                </div>
              </div>
              <span
                className={`text-xs shrink-0 ${m.status === "active" ? "text-emerald-600" : "text-neutral-400"}`}
              >
                {m.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
