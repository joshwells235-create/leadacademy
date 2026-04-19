"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { superArchiveCohort, superUpdateCohort } from "@/lib/super/cohort-actions";

type Props = {
  orgId: string;
  cohort: {
    id: string;
    name: string;
    description: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };
  activeMemberCount: number;
};

export function CohortEditPanel({ orgId, cohort, activeMemberCount }: Props) {
  const [name, setName] = useState(cohort.name);
  const [description, setDescription] = useState(cohort.description ?? "");
  const [startsAt, setStartsAt] = useState(cohort.starts_at ?? "");
  const [endsAt, setEndsAt] = useState(cohort.ends_at ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const router = useRouter();

  const save = () => {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await superUpdateCohort(cohort.id, {
        name,
        description: description || null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  const archive = () => {
    setError(null);
    start(async () => {
      const res = await superArchiveCohort(cohort.id);
      if ("error" in res && res.error) {
        setError(res.error);
        setConfirmingArchive(false);
        return;
      }
      router.push(`/super/orgs/${orgId}`);
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-navy mb-3">Edit cohort</h2>
      <div className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Description</span>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved(false);
            }}
            rows={2}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <div className="grid gap-3 grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-neutral-600 mb-1">Starts</span>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => {
                setStartsAt(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-neutral-600 mb-1">Ends</span>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => {
                setEndsAt(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-xs text-emerald-700">✓ Saved</span>}
          {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        {confirmingArchive ? (
          <ConfirmBlock
            title={`Archive "${cohort.name}"?`}
            tone="destructive"
            confirmLabel="Archive cohort"
            pending={pending}
            onCancel={() => setConfirmingArchive(false)}
            onConfirm={archive}
          >
            {activeMemberCount > 0 ? (
              <>
                Blocked — {activeMemberCount} active member
                {activeMemberCount === 1 ? " is" : "s are"} still in this cohort. Reassign them
                first.
              </>
            ) : (
              <>
                Removes this cohort permanently. History remains in activity logs. Course
                assignments are deleted with it.
              </>
            )}
          </ConfirmBlock>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingArchive(true)}
            className="text-xs text-brand-pink hover:underline"
          >
            Archive this cohort
          </button>
        )}
      </div>
    </section>
  );
}
