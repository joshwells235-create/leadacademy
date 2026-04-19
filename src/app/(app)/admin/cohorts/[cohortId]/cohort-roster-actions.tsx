"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkAssignCohort } from "@/lib/admin/actions";

type RosterMember = {
  membershipId: string;
  name: string;
  role: string;
  roleLabel: string;
  badgeClass: string;
};

/**
 * Select-many rows, act on all at once — move to another cohort or
 * detach from cohort. Admin running a program mid-year needs to move
 * learners around cheaply, not one row at a time.
 */
export function CohortRosterActions({
  members,
  cohortId,
  otherCohorts,
}: {
  members: RosterMember[];
  cohortId: string;
  otherCohorts: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCohort, setTargetCohort] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set());
    else setSelected(new Set(members.map((m) => m.membershipId)));
  };

  const handleMove = () => {
    if (!targetCohort || selected.size === 0) {
      setError("Pick rows and a destination first.");
      return;
    }
    if (targetCohort === cohortId) {
      setError("That's the cohort they're already in.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await bulkAssignCohort(
        Array.from(selected),
        targetCohort === "__none__" ? null : targetCohort,
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setToast(`Moved ${res.count} member${res.count === 1 ? "" : "s"}.`);
      setSelected(new Set());
      setTargetCohort("");
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    });
  };

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-brand-blue/20 bg-brand-blue/5 px-5 py-2 text-sm">
          <span className="font-medium text-brand-navy">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-xs text-neutral-600" htmlFor="move-target">
              Move to:
            </label>
            <select
              id="move-target"
              value={targetCohort}
              onChange={(e) => {
                setTargetCohort(e.target.value);
                setError(null);
              }}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
            >
              <option value="">Select cohort…</option>
              {otherCohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__none__">— No cohort (unpin)</option>
            </select>
            <button
              type="button"
              onClick={handleMove}
              disabled={pending || !targetCohort}
              className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              {pending ? "Moving…" : "Move"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setTargetCohort("");
                setError(null);
              }}
              className="text-xs text-neutral-500 hover:text-brand-navy"
            >
              Clear
            </button>
          </div>
          {error && <p className="basis-full text-xs text-red-700">{error}</p>}
          {toast && <p className="basis-full text-xs text-emerald-700">{toast}</p>}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2">
              <input
                type="checkbox"
                checked={selected.size === members.length && members.length > 0}
                onChange={toggleAll}
                aria-label="Select all members"
                className="rounded border-neutral-300"
              />
            </th>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.membershipId} className="border-b border-neutral-50 hover:bg-brand-light">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(m.membershipId)}
                  onChange={() => toggle(m.membershipId)}
                  aria-label={`Select ${m.name}`}
                  className="rounded border-neutral-300"
                />
              </td>
              <td className="px-3 py-3 font-medium text-brand-navy">{m.name}</td>
              <td className="px-3 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.badgeClass}`}>
                  {m.roleLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
