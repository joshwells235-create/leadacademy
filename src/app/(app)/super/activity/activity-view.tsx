"use client";

import { useMemo, useState } from "react";

export type SuperActivityRow = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
  org_id: string | null;
  org_name: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  // Admin portal
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
  "membership.created_from_invitation": "Accepted invitation",
  "coach_assignment.created": "Assigned coach",
  "coach_assignment.cleared": "Cleared coach assignment",
  "cohort.created": "Created cohort",
  "cohort.updated": "Updated cohort",
  "cohort.archived": "Archived cohort",
  // Super portal
  "super.org.created": "Created organization",
  "super.org.updated": "Updated organization",
  "super.cohort.course_assigned": "Assigned course to cohort",
  "super.cohort.course_removed": "Removed course from cohort",
  "super.cohort.course_scheduled": "Set course unlock window for cohort",
  "super.lesson.prereqs_updated": "Updated lesson prerequisites",
  "super.course.prereqs_updated": "Updated course prerequisites",
  "super.path.created": "Created learning path",
  "super.path.updated": "Updated learning path",
  "super.path.deleted": "Deleted learning path",
  "super.path.courses_set": "Set learning path course list",
  "super.path.assigned": "Assigned learning path to cohort",
  "super.path.unassigned": "Unassigned learning path from cohort",
  "super.certificate.revoked": "Revoked certificate",
  "super.certificate.restored": "Restored revoked certificate",
  "super.post.deleted": "Deleted community post",
  "super.comment.deleted": "Deleted community comment",
  "super.user.profile_updated": "Edited user profile",
  "super.user.email_changed": "Changed user email",
  "super.user.email_confirmed": "Manually confirmed email",
  "super.user.password_reset_sent": "Sent password reset",
  "super.user.sessions_revoked": "Revoked user sessions",
  "super.user.super_admin_granted": "Granted super-admin",
  "super.user.super_admin_revoked": "Revoked super-admin",
  "super.user.soft_deleted": "Soft-deleted user",
  "super.user.restored": "Restored user",
  "super.membership.role_changed": "Changed membership role",
  "super.membership.moved_org": "Moved membership to new org",
  "super.invitation.revoked": "Revoked invitation (cross-org)",
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
  slug: "Slug",
  status: "Status",
  method: "Method",
  course_id: "Course",
  author_user_id: "Author",
  post_id: "Post",
};

function humanizeAction(action: string): string {
  return (
    ACTION_LABEL[action] ?? action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function SuperActivityView({ rows }: { rows: SuperActivityRow[] }) {
  const [query, setQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "super" | "admin">("all");
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

  const orgs = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.org_id) map.set(r.org_id, r.org_name ?? "(unknown)");
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter === "super" && !r.action.startsWith("super.")) return false;
      if (scopeFilter === "admin" && r.action.startsWith("super.")) return false;
      if (actorFilter !== "all" && r.actor_name !== actorFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (orgFilter === "none" && r.org_id) return false;
      if (orgFilter !== "all" && orgFilter !== "none" && r.org_id !== orgFilter) return false;
      if (dateFrom && r.created_at < dateFrom) return false;
      if (dateTo) {
        const cutoff = `${dateTo}T23:59:59.999Z`;
        if (r.created_at > cutoff) return false;
      }
      if (q) {
        const detailStr = JSON.stringify(r.details ?? {}).toLowerCase();
        const hay =
          `${r.actor_name} ${r.org_name ?? ""} ${humanizeAction(r.action)} ${detailStr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, actorFilter, actionFilter, orgFilter, scopeFilter, dateFrom, dateTo]);

  const handleExport = () => {
    const header = "when,who,org,action,target_type,details";
    const body = filtered
      .map((r) => {
        const detailStr = r.details ? JSON.stringify(r.details).replace(/"/g, '""') : "";
        return [
          r.created_at,
          `"${r.actor_name.replace(/"/g, '""')}"`,
          `"${(r.org_name ?? "").replace(/"/g, '""')}"`,
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
    a.download = `super-activity-${stamp}.csv`;
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
          placeholder="Search actor, org, action, or details"
          aria-label="Search activity log"
          className="min-w-[220px] flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as typeof scopeFilter)}
          aria-label="Scope"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">All scopes</option>
          <option value="super">Super-admin only</option>
          <option value="admin">Org-admin only</option>
        </select>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          aria-label="Filter by org"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs max-w-[180px]"
        >
          <option value="all">All orgs</option>
          <option value="none">Cross-org / none</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          aria-label="Filter by actor"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs max-w-[160px]"
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
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs max-w-[180px]"
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
          {rows.length === 0 ? "No activity logged yet." : "No activity matches your filters."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Who</th>
                <th className="px-3 py-2 text-left font-medium">Org</th>
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
                const isSuper = r.action.startsWith("super.");
                return (
                  <tr key={r.id} className="border-b border-neutral-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-neutral-500">
                      {formatWhen(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-brand-navy">{r.actor_name}</td>
                    <td className="px-3 py-2.5 text-[11px] text-neutral-600">
                      {r.org_name ?? <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${isSuper ? "bg-brand-navy/10 text-brand-navy" : "bg-neutral-100 text-neutral-700"}`}
                      >
                        {humanizeAction(r.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-neutral-600">
                      {detailPairs.length > 0 && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {detailPairs.map(([k, v]) => (
                            <span key={k}>
                              <span className="text-neutral-500">{DETAIL_KEY_LABEL[k] ?? k}:</span>{" "}
                              <span className="font-medium">{truncateValue(v)}</span>
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

function truncateValue(v: unknown): string {
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${dateStr} ${timeStr}`;
}
