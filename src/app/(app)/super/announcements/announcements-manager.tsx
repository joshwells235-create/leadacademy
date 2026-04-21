"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { labelForRole } from "@/lib/admin/roles";
import {
  createAnnouncement,
  deleteAnnouncement,
  endAnnouncement,
  updateAnnouncement,
} from "@/lib/super/announcement-actions";

type Scope = "global" | "org" | "cohort" | "role";
type Tone = "info" | "warning" | "success";
type Role = "learner" | "coach" | "org_admin" | "consultant";

export type AnnouncementRow = {
  id: string;
  scope: Scope;
  orgId: string | null;
  orgName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  role: Role | null;
  title: string;
  body: string;
  tone: Tone;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  createdByName: string | null;
};

type OrgOption = { id: string; name: string };
type CohortOption = { id: string; name: string; org_id: string };

const TONE_STYLES: Record<Tone, string> = {
  info: "bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue/20",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

export function AnnouncementsManager({
  rows,
  orgs,
  cohorts,
}: {
  rows: AnnouncementRow[];
  orgs: OrgOption[];
  cohorts: CohortOption[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "ended" | "all">("active");

  const filtered = useMemo(() => {
    const now = new Date().toISOString();
    return rows.filter((r) => {
      const isEnded = r.endsAt !== null && r.endsAt < now;
      if (statusFilter === "active" && isEnded) return false;
      if (statusFilter === "ended" && !isEnded) return false;
      return true;
    });
  }, [rows, statusFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="active">Active</option>
          <option value="ended">Ended</option>
          <option value="all">All</option>
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark"
        >
          + New announcement
        </button>
      </div>

      {creating && (
        <AnnouncementForm orgs={orgs} cohorts={cohorts} onClose={() => setCreating(false)} />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No announcements.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) =>
            editingId === a.id ? (
              <AnnouncementForm
                key={a.id}
                initial={a}
                orgs={orgs}
                cohorts={cohorts}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <AnnouncementCard key={a.id} row={a} onEdit={() => setEditingId(a.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function AnnouncementCard({ row, onEdit }: { row: AnnouncementRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isEnded = row.endsAt !== null && row.endsAt < new Date().toISOString();

  const end = () => {
    setError(null);
    start(async () => {
      const res = await endAnnouncement(row.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const del = () => {
    setError(null);
    start(async () => {
      const res = await deleteAnnouncement(row.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setConfirmingDelete(false);
      router.refresh();
    });
  };

  const scopeLabel =
    row.scope === "global"
      ? "All users"
      : row.scope === "org"
        ? `Org: ${row.orgName ?? "unknown"}`
        : row.scope === "cohort"
          ? `Cohort: ${row.cohortName ?? "unknown"}${row.orgName ? ` (${row.orgName})` : ""}`
          : row.scope === "role" && row.role
            ? `Role: ${labelForRole(row.role)}`
            : row.scope;

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-brand-navy">{row.title}</h3>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TONE_STYLES[row.tone]}`}
            >
              {row.tone}
            </span>
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">
              {scopeLabel}
            </span>
            {isEnded && (
              <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">
                ended
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-700 whitespace-pre-wrap">{row.body}</p>
          <p className="mt-2 text-[11px] text-neutral-500">
            Starts {new Date(row.startsAt).toLocaleString()}
            {row.endsAt && ` · Ends ${new Date(row.endsAt).toLocaleString()}`}
            {row.createdByName && ` · by ${row.createdByName}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <button type="button" onClick={onEdit} className="text-brand-blue hover:underline">
            Edit
          </button>
          {!isEnded && (
            <button
              type="button"
              onClick={end}
              disabled={pending}
              className="text-neutral-500 hover:text-danger disabled:opacity-60"
            >
              End now
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-danger hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
      {confirmingDelete && (
        <div className="mt-3">
          <ConfirmBlock
            title={`Delete "${row.title}"?`}
            tone="destructive"
            confirmLabel="Delete"
            pending={pending}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={del}
          >
            Removes the announcement completely, including dismissal history. Use "End now" instead
            if you just want to hide it from users.
          </ConfirmBlock>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  );
}

function AnnouncementForm({
  initial,
  orgs,
  cohorts,
  onClose,
}: {
  initial?: AnnouncementRow;
  orgs: OrgOption[];
  cohorts: CohortOption[];
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>(initial?.scope ?? "global");
  const [orgId, setOrgId] = useState<string>(initial?.orgId ?? "");
  const [cohortId, setCohortId] = useState<string>(initial?.cohortId ?? "");
  const [role, setRole] = useState<Role | "">(initial?.role ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tone, setTone] = useState<Tone>(initial?.tone ?? "info");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? initial.endsAt.slice(0, 16) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const cohortsInOrg = cohorts.filter((c) => (orgId ? c.org_id === orgId : true));

  const save = () => {
    setError(null);
    start(async () => {
      const payload = {
        scope,
        orgId: scope === "org" || scope === "cohort" ? orgId || null : null,
        cohortId: scope === "cohort" ? cohortId || null : null,
        role: scope === "role" ? ((role || null) as Role | null) : null,
        title,
        body,
        tone,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      };
      const res = initial
        ? await updateAnnouncement(initial.id, payload)
        : await createAnnouncement(payload);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-4 mb-3">
      <h3 className="text-sm font-semibold text-brand-navy mb-3">
        {initial ? "Edit announcement" : "New announcement"}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Scope</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="global">All users (global)</option>
            <option value="org">Specific org</option>
            <option value="cohort">Specific cohort</option>
            <option value="role">All users with a role</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="info">Info (blue)</option>
            <option value="warning">Warning (amber)</option>
            <option value="success">Success (green)</option>
          </select>
        </label>
        {(scope === "org" || scope === "cohort") && (
          <label className="block">
            <span className="block text-xs font-medium text-neutral-600 mb-1">Organization</span>
            <select
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setCohortId("");
              }}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">— pick an org —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === "cohort" && (
          <label className="block">
            <span className="block text-xs font-medium text-neutral-600 mb-1">Cohort</span>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">— pick a cohort —</option>
              {cohortsInOrg.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === "role" && (
          <label className="block">
            <span className="block text-xs font-medium text-neutral-600 mb-1">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">— pick a role —</option>
              <option value="learner">Learners</option>
              <option value="coach">Coaches</option>
              <option value="org_admin">Org Admins</option>
              <option value="consultant">Consultants</option>
            </select>
          </label>
        )}
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">
            Ends at (optional)
          </span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !title.trim() || !body.trim()}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Publish announcement"}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-neutral-500">
          Cancel
        </button>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
