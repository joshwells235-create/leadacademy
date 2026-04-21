"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { labelForRole, roleBadgeClass } from "@/lib/admin/roles";

export type UserRow = {
  userId: string;
  displayName: string;
  email: string | null;
  emailConfirmed: boolean;
  isSuperAdmin: boolean;
  deletedAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  memberships: Array<{
    orgId: string;
    orgName: string;
    role: string;
    status: string;
    cohortName: string | null;
  }>;
};

export function UsersDirectory({ rows }: { rows: UserRow[] }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted" | "all" | "super_admin">(
    "active",
  );
  const [sort, setSort] = useState<"name" | "recent" | "last_seen">("name");

  const orgs = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      for (const m of r.memberships) map.set(m.orgId, m.orgName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statusFilter === "active" && r.deletedAt) return false;
      if (statusFilter === "deleted" && !r.deletedAt) return false;
      if (statusFilter === "super_admin" && !r.isSuperAdmin) return false;
      if (roleFilter !== "all" && !r.memberships.some((m) => m.role === roleFilter)) return false;
      if (orgFilter !== "all" && !r.memberships.some((m) => m.orgId === orgFilter)) return false;
      if (q) {
        const hay =
          `${r.displayName} ${r.email ?? ""} ${r.memberships.map((m) => m.orgName).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (sort === "recent") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "last_seen") return (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "");
      return a.displayName.localeCompare(b.displayName);
    });
    return list;
  }, [rows, query, roleFilter, orgFilter, statusFilter, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, or org"
          className="flex-1 min-w-[240px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by status"
        >
          <option value="active">Active</option>
          <option value="deleted">Soft-deleted</option>
          <option value="super_admin">Super admins</option>
          <option value="all">All users</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          <option value="learner">Learners</option>
          <option value="coach">Coaches</option>
          <option value="org_admin">Org Admins</option>
          <option value="consultant">Consultants</option>
        </select>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue max-w-[180px]"
          aria-label="Filter by organization"
        >
          <option value="all">All orgs</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Sort"
        >
          <option value="name">Sort: Name</option>
          <option value="recent">Sort: Recently created</option>
          <option value="last_seen">Sort: Last sign-in</option>
        </select>
        <div className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No users match those filters.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Orgs / roles</th>
                <th className="px-3 py-2 text-left font-medium">Last sign-in</th>
                <th className="px-3 py-2 text-left font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.userId}
                  className="border-b border-neutral-50 hover:bg-brand-light transition"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/super/users/${r.userId}`}
                      className="font-medium text-brand-navy hover:text-brand-blue"
                    >
                      {r.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-600">
                    {r.email ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.memberships.length === 0 ? (
                      <span className="text-xs text-neutral-400">no memberships</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.memberships.map((m, i) => (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: per-row index is stable
                            key={i}
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${roleBadgeClass(m.role)}`}
                            title={`${labelForRole(m.role)} in ${m.orgName}${m.cohortName ? ` · ${m.cohortName}` : ""}${m.status !== "active" ? ` (${m.status})` : ""}`}
                          >
                            {m.orgName} · {labelForRole(m.role)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-neutral-500">
                    {r.lastSignInAt ? new Date(r.lastSignInAt).toLocaleDateString() : "never"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.isSuperAdmin && (
                        <span className="rounded-full bg-brand-navy/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-navy">
                          super admin
                        </span>
                      )}
                      {r.deletedAt && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          deleted
                        </span>
                      )}
                      {!r.emailConfirmed && (
                        <span
                          title="Email never confirmed"
                          className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200"
                        >
                          unconfirmed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
