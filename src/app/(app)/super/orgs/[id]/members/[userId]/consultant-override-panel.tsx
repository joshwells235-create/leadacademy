"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLearnerConsultantOverride } from "@/lib/consultant/actions";

type Candidate = { user_id: string; display_name: string | null };

/**
 * Super-admin surface for assigning a per-learner consultant override.
 * Clearing the override makes the learner fall back to the cohort default.
 * Used for cases like the open academy where one cohort spans multiple
 * consultants covering different subsets of participants.
 */
export function ConsultantOverridePanel({
  learnerUserId,
  currentOverrideUserId,
  currentOverrideName,
  cohortDefaultUserId,
  cohortDefaultName,
  candidates,
}: {
  learnerUserId: string;
  currentOverrideUserId: string | null;
  currentOverrideName: string | null;
  cohortDefaultUserId: string | null;
  cohortDefaultName: string | null;
  candidates: Candidate[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentOverrideUserId ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const save = (next: string | null) => {
    setError(null);
    start(async () => {
      const res = await setLearnerConsultantOverride(learnerUserId, next);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const effectiveName = currentOverrideName ?? cohortDefaultName ?? "not assigned";
  const effectiveSource = currentOverrideUserId
    ? "override set for this learner"
    : cohortDefaultUserId
      ? "using cohort default"
      : "no consultant assigned";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-brand-navy">Consultant</h2>
      <p className="text-sm text-brand-navy">{effectiveName}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{effectiveSource}</p>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">— use cohort default —</option>
            {candidates.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.display_name ?? "Unnamed"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => save(value || null)}
            disabled={pending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue(currentOverrideUserId ?? "");
            }}
            className="text-xs text-neutral-500"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-brand-blue hover:underline"
          >
            {currentOverrideUserId ? "Change override" : "Set override"}
          </button>
          {currentOverrideUserId && (
            <button
              type="button"
              onClick={() => save(null)}
              disabled={pending}
              className="text-neutral-500 hover:text-red-600 disabled:opacity-60"
            >
              Clear override (use default)
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}

      <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-500">
        Override lets you assign a different consultant for just this learner — useful when one
        cohort contains participants from multiple orgs with different consultants. Candidates are
        active consultants in this org.
      </p>
    </div>
  );
}
