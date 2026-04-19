"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCohortMetadata } from "@/lib/consultant/actions";

/**
 * Inline editor for the cohort fields a consultant cares about —
 * description + capstone unlock date. Wraps the updateCohortMetadata
 * action. Full cohort lifecycle (name, dates, org) stays on the admin
 * side to avoid cross-role confusion.
 */
export function CohortEditor({
  cohortId,
  initialDescription,
  initialCapstoneUnlocksAt,
}: {
  cohortId: string;
  initialDescription: string | null;
  initialCapstoneUnlocksAt: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [capstoneUnlocksAt, setCapstoneUnlocksAt] = useState(initialCapstoneUnlocksAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await updateCohortMetadata(cohortId, {
        description,
        capstoneUnlocksAt,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSavedToast("Saved");
      setEditing(false);
      setTimeout(() => setSavedToast(null), 2500);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-brand-light"
        >
          Edit cohort info
        </button>
        {savedToast && (
          <span role="status" className="text-xs text-emerald-700">
            {savedToast}
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-brand-blue/30 bg-brand-blue/5 p-3 text-sm"
    >
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What this cohort is about — audience, theme, anything worth noting."
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-neutral-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          Capstone unlock date
          <input
            type="date"
            value={capstoneUnlocksAt}
            onChange={(e) => setCapstoneUnlocksAt(e.target.value)}
            className="mt-1 block rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-normal normal-case tracking-normal text-neutral-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          Learners see the capstone builder unlock on this date. Leave blank if not yet scheduled.
        </p>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDescription(initialDescription ?? "");
            setCapstoneUnlocksAt(initialCapstoneUnlocksAt ?? "");
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-brand-light disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
