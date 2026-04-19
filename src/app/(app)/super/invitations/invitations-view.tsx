"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { labelForRole, roleBadgeClass } from "@/lib/admin/roles";
import { revokeInvitation } from "@/lib/super/user-actions";

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: "pending" | "expired" | "consumed";
  orgId: string;
  orgName: string;
  cohortId: string | null;
  cohortName: string | null;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  invitedByName: string | null;
};

const STATUS_STYLE: Record<InvitationRow["status"], string> = {
  pending: "bg-brand-blue/10 text-brand-blue",
  expired: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  consumed: "bg-emerald-50 text-emerald-700",
};

export function InvitationsView({ rows }: { rows: InvitationRow[] }) {
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"pending" | "expired" | "consumed" | "all">(
    "pending",
  );
  const [revoking, setRevoking] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const orgs = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.orgId, r.orgName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (orgFilter !== "all" && r.orgId !== orgFilter) return false;
      if (q) {
        const hay = `${r.email} ${r.orgName} ${r.invitedByName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, orgFilter, statusFilter]);

  const runRevoke = (id: string) => {
    setError(null);
    start(async () => {
      const res = await revokeInvitation(id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setRevoking(null);
      router.refresh();
    });
  };

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    expired: rows.filter((r) => r.status === "expired").length,
    consumed: rows.filter((r) => r.status === "consumed").length,
  };

  return (
    <div>
      <div className="grid gap-3 grid-cols-3 md:grid-cols-3 mb-6">
        <Stat label="Pending" value={counts.pending} tone="blue" />
        <Stat label="Expired" value={counts.expired} tone="amber" />
        <Stat label="Consumed" value={counts.consumed} tone="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email, org, or inviter"
          className="flex-1 min-w-[220px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by status"
        >
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="consumed">Consumed</option>
          <option value="all">All statuses</option>
        </select>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue max-w-[220px]"
          aria-label="Filter by organization"
        >
          <option value="all">All orgs</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No invitations match these filters.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Org / cohort</th>
                <th className="px-3 py-2 text-left font-medium">Role</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-left font-medium">Expires</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-neutral-50 hover:bg-brand-light">
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-navy">{r.email}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <Link
                      href={`/super/orgs/${r.orgId}`}
                      className="text-brand-navy hover:text-brand-blue"
                    >
                      {r.orgName}
                    </Link>
                    {r.cohortName && <span className="text-neutral-400"> · {r.cohortName}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClass(r.role)}`}
                    >
                      {labelForRole(r.role)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-neutral-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-neutral-500">
                    {new Date(r.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => setRevoking(r.id)}
                        className="text-[11px] text-brand-pink hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {revoking && (
        <div className="mt-4">
          <ConfirmBlock
            title="Revoke this invitation?"
            tone="destructive"
            confirmLabel="Revoke"
            pending={pending}
            onCancel={() => setRevoking(null)}
            onConfirm={() => runRevoke(revoking)}
          >
            The link will stop working immediately. The invitee can be re-invited from the org's
            People tab.
          </ConfirmBlock>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "amber" | "emerald";
}) {
  const color = {
    blue: "text-brand-blue",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
  }[tone];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
