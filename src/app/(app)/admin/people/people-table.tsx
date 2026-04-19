"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import {
  archiveMember,
  assignCoach,
  bulkArchive,
  bulkAssignCohort,
  bulkUnarchive,
  changeRole,
  reassignCohort,
  unarchiveMember,
} from "@/lib/admin/actions";
import { labelForRole, MEMBER_ROLES, type MemberRole, ROLE_DESCRIPTION } from "@/lib/admin/roles";

export type PeopleRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  roleBadgeClass: string;
  cohortId: string | null;
  cohortName: string | null;
  coachUserId: string | null;
  coachName: string | null;
  status: string;
  intakeCompleted: boolean;
  lastActivityDate: string | null;
  daysSinceActivity: number | null;
  atRiskFlags: AtRiskFlag[];
};

export type AtRiskFlag = "no-coach" | "no-activity-14d" | "intake-incomplete";

const FLAG_LABEL: Record<AtRiskFlag, string> = {
  "no-coach": "No coach",
  "no-activity-14d": "Quiet 14d+",
  "intake-incomplete": "Intake pending",
};
const FLAG_BADGE_CLASS: Record<AtRiskFlag, string> = {
  "no-coach": "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  "no-activity-14d": "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  "intake-incomplete": "bg-neutral-100 text-neutral-600",
};

type CoachOption = { userId: string; name: string };
type CohortOption = { id: string; name: string };

export function PeopleTable({
  rows,
  coaches,
  cohorts,
}: {
  rows: PeopleRow[];
  coaches: CoachOption[];
  cohorts: CohortOption[];
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [flagFilter, setFlagFilter] = useState<
    "any-risk" | "no-coach" | "quiet" | "intake" | "all"
  >("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (cohortFilter === "none" && r.cohortId) return false;
      if (cohortFilter !== "all" && cohortFilter !== "none" && r.cohortId !== cohortFilter)
        return false;
      if (coachFilter === "none" && r.coachUserId) return false;
      if (coachFilter !== "all" && coachFilter !== "none" && r.coachUserId !== coachFilter)
        return false;
      if (flagFilter === "any-risk" && r.atRiskFlags.length === 0) return false;
      if (flagFilter === "no-coach" && !r.atRiskFlags.includes("no-coach")) return false;
      if (flagFilter === "quiet" && !r.atRiskFlags.includes("no-activity-14d")) return false;
      if (flagFilter === "intake" && !r.atRiskFlags.includes("intake-incomplete")) return false;
      if (q) {
        const hay = `${r.name} ${r.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, roleFilter, cohortFilter, coachFilter, statusFilter, flagFilter]);

  const activeCount = rows.filter((r) => r.status === "active").length;

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.membershipId)));
  };

  const resetSelection = () => setSelected(new Set());

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">
            Members <span className="text-neutral-400">({activeCount} active)</span>
          </h3>
          <p className="text-[11px] text-neutral-500">
            {filtered.length === rows.length
              ? null
              : `Showing ${filtered.length} of ${rows.length}`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search members"
            className="w-40 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            <option value="all">All roles</option>
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {labelForRole(r)}
              </option>
            ))}
          </select>
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            aria-label="Filter by cohort"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
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
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            aria-label="Filter by coach"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            <option value="all">All coaches</option>
            <option value="none">No coach</option>
            {coaches.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as typeof flagFilter)}
            aria-label="Filter by at-risk flags"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            <option value="any-risk">Any at-risk flag</option>
            <option value="no-coach">No coach</option>
            <option value="quiet">Quiet 14d+</option>
            <option value="intake">Intake pending</option>
          </select>
          <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-[11px]">
            <StatusPill
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
              label="Active"
            />
            <StatusPill
              active={statusFilter === "archived"}
              onClick={() => setStatusFilter("archived")}
              label="Archived"
            />
            <StatusPill
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label="All"
            />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <BulkBar
          selectedIds={Array.from(selected)}
          selectedRows={rows.filter((r) => selected.has(r.membershipId))}
          cohorts={cohorts}
          coaches={coaches}
          onDone={() => resetSelection()}
        />
      )}

      {filtered.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500">
          {rows.length === 0
            ? "No members yet — invite your first learner using the form above."
            : "No members match your filter."}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all visible"
                  className="rounded border-neutral-300"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium">Cohort</th>
              <th className="px-3 py-2 text-left font-medium">Coach</th>
              <th className="px-3 py-2 text-left font-medium">Last active</th>
              <th className="px-3 py-2 text-left font-medium">Flags</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <MemberRow
                key={r.membershipId}
                row={r}
                coaches={coaches}
                cohorts={cohorts}
                selected={selected.has(r.membershipId)}
                onToggle={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.membershipId)) next.delete(r.membershipId);
                    else next.add(r.membershipId);
                    return next;
                  });
                }}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusPill({
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
      className={`rounded px-2 py-0.5 font-medium transition ${
        active ? "bg-brand-blue text-white shadow-sm" : "text-neutral-600 hover:bg-brand-light"
      }`}
    >
      {label}
    </button>
  );
}

function MemberRow({
  row,
  coaches,
  cohorts,
  selected,
  onToggle,
}: {
  row: PeopleRow;
  coaches: CoachOption[];
  cohorts: CohortOption[];
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<"cohort" | "coach" | "role" | null>(null);
  const [archivingConfirm, setArchivingConfirm] = useState<"archive" | "unarchive" | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCoach = (coachId: string | null) => {
    setActionError(null);
    start(async () => {
      const res = await assignCoach(row.userId, coachId);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  };

  const handleCohort = (cohortId: string | null) => {
    setActionError(null);
    start(async () => {
      const res = await reassignCohort(row.membershipId, cohortId);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  };

  const handleRole = (newRole: string) => {
    setActionError(null);
    start(async () => {
      const res = await changeRole(row.membershipId, newRole);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setRoleConfirm(null);
      router.refresh();
    });
  };

  const handleArchive = () => {
    setActionError(null);
    start(async () => {
      const res = await archiveMember(row.membershipId);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setArchivingConfirm(null);
      router.refresh();
    });
  };

  const handleUnarchive = () => {
    setActionError(null);
    start(async () => {
      const res = await unarchiveMember(row.membershipId);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setArchivingConfirm(null);
      router.refresh();
    });
  };

  return (
    <>
      <tr
        className={`border-b border-neutral-50 hover:bg-brand-light ${row.status === "archived" ? "opacity-60" : ""}`}
      >
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${row.name}`}
            className="rounded border-neutral-300"
          />
        </td>
        <td className="px-3 py-2.5">
          <div className="font-medium text-brand-navy">{row.name}</div>
          <div className="text-[11px] text-neutral-500">{row.email}</div>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${row.roleBadgeClass}`}
          >
            {row.roleLabel}
          </span>
        </td>
        <td className="px-3 py-2.5 text-neutral-700">
          {editing === "cohort" ? (
            <CohortPicker
              value={row.cohortId}
              cohorts={cohorts}
              onCommit={handleCohort}
              onCancel={() => setEditing(null)}
              pending={pending}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("cohort")}
              className="text-left hover:text-brand-blue hover:underline"
            >
              {row.cohortName ?? <span className="text-neutral-400">—</span>}
            </button>
          )}
        </td>
        <td className="px-3 py-2.5 text-neutral-700">
          {row.role !== "learner" ? (
            <span className="text-neutral-400">—</span>
          ) : editing === "coach" ? (
            <CoachPicker
              value={row.coachUserId}
              coaches={coaches}
              onCommit={handleCoach}
              onCancel={() => setEditing(null)}
              pending={pending}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("coach")}
              className="text-left hover:text-brand-blue hover:underline"
            >
              {row.coachName ?? <span className="text-amber-700">Assign…</span>}
            </button>
          )}
        </td>
        <td className="px-3 py-2.5 text-[11px] text-neutral-600">
          {row.lastActivityDate ? (
            <>
              {row.lastActivityDate}
              {row.daysSinceActivity != null && row.daysSinceActivity >= 14 && (
                <span className="ml-1 text-amber-700">({row.daysSinceActivity}d)</span>
              )}
            </>
          ) : (
            <span className="text-neutral-400">Never</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          {row.atRiskFlags.length === 0 ? (
            <span className="text-[11px] text-neutral-300">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.atRiskFlags.map((f) => (
                <span
                  key={f}
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${FLAG_BADGE_CLASS[f]}`}
                >
                  {FLAG_LABEL[f]}
                </span>
              ))}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="inline-flex flex-wrap justify-end gap-1 text-[11px]">
            {row.status === "archived" ? (
              <button
                type="button"
                onClick={() => setArchivingConfirm("unarchive")}
                className="rounded border border-emerald-200 bg-white px-2 py-0.5 text-emerald-700 hover:bg-emerald-50"
              >
                Unarchive
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing("role")}
                  className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-neutral-700 hover:bg-brand-light"
                >
                  Change role
                </button>
                <button
                  type="button"
                  onClick={() => setArchivingConfirm("archive")}
                  className="rounded border border-brand-pink/30 bg-white px-2 py-0.5 text-brand-pink hover:bg-brand-pink/10"
                >
                  Archive
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {(editing === "role" || archivingConfirm || actionError) && (
        <tr className="bg-neutral-50">
          <td colSpan={8} className="px-4 py-3">
            {editing === "role" && (
              <div>
                <p className="text-xs font-semibold text-brand-navy">Change {row.name}'s role</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">Current: {row.roleLabel}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MEMBER_ROLES.filter((r) => r !== row.role).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleConfirm(r)}
                      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-brand-light"
                    >
                      {labelForRole(r)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="text-xs text-neutral-500 hover:text-brand-navy"
                  >
                    Cancel
                  </button>
                </div>
                {roleConfirm && (
                  <div className="mt-3">
                    <ConfirmBlock
                      title={`Set role to ${labelForRole(roleConfirm)}?`}
                      tone={roleConfirm === "org_admin" ? "destructive" : "caution"}
                      confirmLabel="Change role"
                      pending={pending}
                      error={actionError}
                      onConfirm={() => handleRole(roleConfirm)}
                      onCancel={() => {
                        setRoleConfirm(null);
                        setActionError(null);
                      }}
                    >
                      <p>{ROLE_DESCRIPTION[roleConfirm as MemberRole]}</p>
                      {roleConfirm === "org_admin" && (
                        <p className="mt-1 font-medium text-brand-pink">
                          High-impact change: gives {row.name} full admin access to this org.
                        </p>
                      )}
                    </ConfirmBlock>
                  </div>
                )}
              </div>
            )}

            {archivingConfirm === "archive" && (
              <ConfirmBlock
                title={`Archive ${row.name}?`}
                tone="destructive"
                confirmLabel="Archive"
                pending={pending}
                error={actionError}
                onConfirm={handleArchive}
                onCancel={() => {
                  setArchivingConfirm(null);
                  setActionError(null);
                }}
              >
                They'll stop appearing in active-member views and won't be able to sign in. Their
                data (goals, reflections, actions, assessments) is preserved; you can unarchive
                later without losing anything.
              </ConfirmBlock>
            )}

            {archivingConfirm === "unarchive" && (
              <ConfirmBlock
                title={`Unarchive ${row.name}?`}
                tone="restorative"
                confirmLabel="Unarchive"
                pending={pending}
                error={actionError}
                onConfirm={handleUnarchive}
                onCancel={() => {
                  setArchivingConfirm(null);
                  setActionError(null);
                }}
              >
                They'll become an active member again with the same role and cohort as before.
              </ConfirmBlock>
            )}

            {actionError && !archivingConfirm && !roleConfirm && (
              <p className="text-xs text-red-700">{actionError}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CoachPicker({
  value,
  coaches,
  onCommit,
  onCancel,
  pending,
}: {
  value: string | null;
  coaches: CoachOption[];
  onCommit: (id: string | null) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState<string>(value ?? "");
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
        aria-label="Pick a coach"
        className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs"
      >
        <option value="">— No coach —</option>
        {coaches.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onCommit(picked || null)}
        disabled={pending || picked === (value ?? "")}
        className="rounded bg-brand-blue px-2 py-0.5 text-[11px] text-white hover:bg-brand-blue-dark disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-[11px] text-neutral-500"
      >
        Cancel
      </button>
    </div>
  );
}

function CohortPicker({
  value,
  cohorts,
  onCommit,
  onCancel,
  pending,
}: {
  value: string | null;
  cohorts: CohortOption[];
  onCommit: (id: string | null) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState<string>(value ?? "");
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
        aria-label="Pick a cohort"
        className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs"
      >
        <option value="">— No cohort —</option>
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onCommit(picked || null)}
        disabled={pending || picked === (value ?? "")}
        className="rounded bg-brand-blue px-2 py-0.5 text-[11px] text-white hover:bg-brand-blue-dark disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-[11px] text-neutral-500"
      >
        Cancel
      </button>
    </div>
  );
}

function BulkBar({
  selectedIds,
  selectedRows,
  cohorts,
  coaches,
  onDone,
}: {
  selectedIds: string[];
  selectedRows: PeopleRow[];
  cohorts: CohortOption[];
  coaches: CoachOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"cohort" | "coach" | "archive" | "unarchive" | null>(null);
  const [cohortTarget, setCohortTarget] = useState<string>("");
  const [coachTarget, setCoachTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"archive" | "unarchive" | null>(null);

  const onlyLearners = selectedRows.every((r) => r.role === "learner");

  const handleBulkCohort = () => {
    if (!cohortTarget) {
      setError("Pick a cohort or 'No cohort'.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await bulkAssignCohort(
        selectedIds,
        cohortTarget === "__none__" ? null : cohortTarget,
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
      setAction(null);
      setCohortTarget("");
      router.refresh();
    });
  };

  const handleBulkCoach = () => {
    if (!coachTarget) {
      setError("Pick a coach.");
      return;
    }
    if (!onlyLearners) {
      setError("Coach assignment only applies to learners — deselect non-learner rows.");
      return;
    }
    setError(null);
    start(async () => {
      // bulkAssignCoach takes learner user IDs, not membership IDs
      const learnerIds = selectedRows.filter((r) => r.role === "learner").map((r) => r.userId);
      const res = await (await import("@/lib/admin/actions")).bulkAssignCoach(
        learnerIds,
        coachTarget,
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
      setAction(null);
      setCoachTarget("");
      router.refresh();
    });
  };

  const handleBulkArchive = () => {
    setError(null);
    start(async () => {
      const res = await bulkArchive(selectedIds);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
      setConfirming(null);
      setAction(null);
      router.refresh();
    });
  };

  const handleBulkUnarchive = () => {
    setError(null);
    start(async () => {
      const res = await bulkUnarchive(selectedIds);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
      setConfirming(null);
      setAction(null);
      router.refresh();
    });
  };

  return (
    <div className="sticky top-0 z-10 border-b border-brand-blue/30 bg-brand-blue/5 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-brand-navy">{selectedIds.length} selected</span>
        <button
          type="button"
          onClick={() => setAction("cohort")}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-brand-light"
        >
          Move cohort…
        </button>
        <button
          type="button"
          onClick={() => setAction("coach")}
          disabled={!onlyLearners}
          title={!onlyLearners ? "Coach assignment only applies to learners" : ""}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-brand-light disabled:opacity-50"
        >
          Assign coach…
        </button>
        <button
          type="button"
          onClick={() => setConfirming("archive")}
          className="rounded-md border border-brand-pink/30 bg-white px-2 py-1 text-xs text-brand-pink hover:bg-brand-pink/10"
        >
          Archive…
        </button>
        <button
          type="button"
          onClick={() => setConfirming("unarchive")}
          className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
        >
          Unarchive…
        </button>
        <button
          type="button"
          onClick={() => {
            onDone();
            setAction(null);
            setError(null);
          }}
          className="ml-auto text-xs text-neutral-500 hover:text-brand-navy"
        >
          Clear selection
        </button>
      </div>

      {action === "cohort" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={cohortTarget}
            onChange={(e) => setCohortTarget(e.target.value)}
            aria-label="Target cohort"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">Pick cohort…</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__none__">— No cohort —</option>
          </select>
          <button
            type="button"
            onClick={handleBulkCohort}
            disabled={pending || !cohortTarget}
            className="rounded bg-brand-blue px-3 py-1 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {pending ? "Moving…" : "Move"}
          </button>
          <button
            type="button"
            onClick={() => setAction(null)}
            className="text-xs text-neutral-500"
          >
            Cancel
          </button>
        </div>
      )}

      {action === "coach" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={coachTarget}
            onChange={(e) => setCoachTarget(e.target.value)}
            aria-label="Target coach"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">Pick coach…</option>
            {coaches.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkCoach}
            disabled={pending || !coachTarget}
            className="rounded bg-brand-blue px-3 py-1 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {pending ? "Assigning…" : "Assign"}
          </button>
          <button
            type="button"
            onClick={() => setAction(null)}
            className="text-xs text-neutral-500"
          >
            Cancel
          </button>
        </div>
      )}

      {confirming === "archive" && (
        <div className="mt-2">
          <ConfirmBlock
            title={`Archive ${selectedIds.length} member${selectedIds.length === 1 ? "" : "s"}?`}
            tone="destructive"
            confirmLabel={`Archive ${selectedIds.length}`}
            pending={pending}
            error={error}
            onConfirm={handleBulkArchive}
            onCancel={() => {
              setConfirming(null);
              setError(null);
            }}
          >
            Selected members will stop appearing in active views and won't be able to sign in. Their
            data is preserved; you can unarchive later.
          </ConfirmBlock>
        </div>
      )}

      {confirming === "unarchive" && (
        <div className="mt-2">
          <ConfirmBlock
            title={`Unarchive ${selectedIds.length} member${selectedIds.length === 1 ? "" : "s"}?`}
            tone="restorative"
            confirmLabel={`Unarchive ${selectedIds.length}`}
            pending={pending}
            error={error}
            onConfirm={handleBulkUnarchive}
            onCancel={() => {
              setConfirming(null);
              setError(null);
            }}
          >
            They'll become active members again with their prior roles and cohorts.
          </ConfirmBlock>
        </div>
      )}

      {error && !confirming && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
