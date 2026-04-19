"use client";

import { useMemo, useState } from "react";

export type ActivityLogRow = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
};

const ACTION_LABEL: Record<string, string> = {
  "invitation.created": "Invited new member",
  "invitation.resent": "Resent invitation",
  "invitation.revoked": "Revoked invitation",
  "membership.role_changed": "Changed role",
  "membership.archived": "Archived member",
  "membership.unarchived": "Unarchived member",
  "membership.cohort_reassigned": "Moved between cohorts",
  "membership.bulk_archived": "Bulk archived members",
  "membership.bulk_unarchived": "Bulk unarchived members",
  "membership.bulk_cohort_reassigned": "Bulk moved between cohorts",
  "membership.manually_added": "Manually created user",
  "coach_assignment.created": "Assigned coach",
  "coach_assignment.cleared": "Cleared coach assignment",
  "cohort.created": "Created cohort",
  "cohort.updated": "Updated cohort",
  "cohort.archived": "Archived cohort",
  "membership.created_from_invitation": "Accepted invitation",
};

const DETAIL_KEY_LABEL: Record<string, string> = {
  email: "Email",
  role: "Role",
  from: "From",
  to: "To",
  count: "Count",
  cohort_id: "Cohort",
  coach_user_id: "Coach",
  learner_user_id: "Learner",
  invitation_id: "Invitation",
  name: "Name",
  method: "Method",
};

function humanizeAction(action: string): string {
  return (
    ACTION_LABEL[action] ?? action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function ActivityView({ rows }: { rows: ActivityLogRow[] }) {
  const [query, setQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const actors = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.actor_name);
    return Array.from(set).sort();
  }, [rows]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.action);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (actorFilter !== "all" && r.actor_name !== actorFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (dateFrom && r.created_at < dateFrom) return false;
      if (dateTo) {
        // Include all of dateTo day — compare with end-of-day
        const cutoff = `${dateTo}T23:59:59.999Z`;
        if (r.created_at > cutoff) return false;
      }
      if (q) {
        const detailStr = JSON.stringify(r.details ?? {}).toLowerCase();
        const hay = `${r.actor_name} ${humanizeAction(r.action)} ${detailStr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, actorFilter, actionFilter, dateFrom, dateTo]);

  const handleExport = () => {
    const rowsToExport = filtered;
    const header = "when,who,action,target_type,details";
    const body = rowsToExport
      .map((r) => {
        const detailStr = r.details ? JSON.stringify(r.details).replace(/"/g, '""') : "";
        return [
          r.created_at,
          `"${r.actor_name.replace(/"/g, '""')}"`,
          `"${humanizeAction(r.action).replace(/"/g, '""')}"`,
          r.target_type ?? "",
          `"${detailStr}"`,
        ].join(",");
      })
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `activity-log-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actor, action, or details"
          aria-label="Search activity log"
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          aria-label="Filter by actor"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">All actors</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter by action"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {humanizeAction(a)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-neutral-600">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-neutral-600">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs"
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="ml-auto rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-brand-light disabled:opacity-50"
        >
          Export CSV ({filtered.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          {rows.length === 0
            ? "No activity yet. Actions like invitations, role changes, and coach assignments will appear here."
            : "No activity matches your filters."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Who</th>
                <th className="px-3 py-2 text-left font-medium">Action</th>
                <th className="px-3 py-2 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const details = r.details ?? {};
                const detailPairs = Object.entries(details).filter(
                  ([, v]) => v !== null && v !== undefined && v !== "",
                );
                return (
                  <tr key={r.id} className="border-b border-neutral-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-neutral-500">
                      {formatWhen(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-brand-navy">{r.actor_name}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
                        {humanizeAction(r.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-neutral-600">
                      {detailPairs.length > 0 && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {detailPairs.map(([k, v]) => (
                            <span key={k}>
                              <span className="text-neutral-500">{DETAIL_KEY_LABEL[k] ?? k}:</span>{" "}
                              <span className="font-medium">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${dateStr} ${timeStr}`;
}
