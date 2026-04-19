"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { archiveCohort, createCohort, updateCohort } from "@/lib/admin/actions";

export type CohortListRow = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capstone_unlocks_at: string | null;
  consultant_name: string | null;
  memberCount: number;
};

export function CohortManager({ cohorts }: { cohorts: CohortListRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleArchive = (id: string) => {
    setArchiveError(null);
    start(async () => {
      const res = await archiveCohort(id);
      if ("error" in res) {
        setArchiveError(res.error);
        return;
      }
      setArchivingId(null);
      router.refresh();
    });
  };

  return (
    <div>
      {cohorts.length === 0 && !creating && (
        <div className="mb-6 rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
          <h3 className="font-semibold text-brand-navy">No cohorts yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-600">
            Cohorts group learners going through the program together. Create one to get started —
            every invite you send can optionally pin a learner to a cohort.
          </p>
        </div>
      )}

      {creating ? (
        <CohortForm
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mb-6 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          + New cohort
        </button>
      )}

      {cohorts.length > 0 && (
        <div className="space-y-3">
          {cohorts.map((c) => {
            const isEditing = editingId === c.id;
            const isArchiving = archivingId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
              >
                {isEditing ? (
                  <CohortForm
                    initial={c}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-brand-navy">{c.name}</h3>
                          {c.consultant_name && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
                              Consultant: {c.consultant_name}
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <p className="mt-0.5 text-sm text-neutral-600">{c.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                          <span className="font-medium text-neutral-700">
                            {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                          </span>
                          {c.starts_at && <span>Starts {c.starts_at}</span>}
                          {c.ends_at && <span>Ends {c.ends_at}</span>}
                          {c.capstone_unlocks_at && (
                            <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 font-medium text-brand-pink">
                              Capstone unlocks {c.capstone_unlocks_at}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/admin/cohorts/${c.id}`}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-brand-light"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-brand-light"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setArchivingId(c.id);
                            setArchiveError(null);
                          }}
                          className="rounded-md px-3 py-1 text-xs text-brand-pink hover:bg-brand-pink/10"
                        >
                          Archive
                        </button>
                      </div>
                    </div>

                    {isArchiving && (
                      <div className="mt-3">
                        <ConfirmBlock
                          title={`Archive "${c.name}"?`}
                          tone="destructive"
                          confirmLabel="Archive cohort"
                          pending={pending}
                          error={archiveError}
                          onCancel={() => {
                            setArchivingId(null);
                            setArchiveError(null);
                          }}
                          onConfirm={() => handleArchive(c.id)}
                        >
                          {c.memberCount > 0 ? (
                            <>
                              This cohort has {c.memberCount} active member
                              {c.memberCount === 1 ? "" : "s"}. You'll need to reassign them before
                              archiving — open the cohort and move them to another cohort first.
                            </>
                          ) : (
                            <>
                              Cohort row will be removed. Learner data (goals, actions, reflections)
                              isn't touched.
                            </>
                          )}
                        </ConfirmBlock>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CohortForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: CohortListRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [startsAt, setStartsAt] = useState(initial?.starts_at ?? "");
  const [endsAt, setEndsAt] = useState(initial?.ends_at ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Cohort name is required.");
      return;
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setError("End date can't be before start date.");
      return;
    }
    start(async () => {
      const payload = {
        name: name.trim(),
        description: desc.trim() || null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      };
      const res = initial ? await updateCohort(initial.id, payload) : await createCohort(payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="cohort-name" className="text-xs font-medium text-neutral-600">
          Name
        </label>
        <input
          id="cohort-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cohort name (e.g., Spring 2026)"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          // biome-ignore lint/a11y/noAutofocus: user just opened this form by clicking a button
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="cohort-desc" className="text-xs font-medium text-neutral-600">
          Description (optional)
        </label>
        <textarea
          id="cohort-desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Brief context — audience, theme, anything worth noting"
          rows={2}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </div>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Program dates</legend>
        <div>
          <label htmlFor="cohort-start" className="text-xs text-neutral-500">
            Start date
          </label>
          <input
            id="cohort-start"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="cohort-end" className="text-xs text-neutral-500">
            End date
          </label>
          <input
            id="cohort-end"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </fieldset>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Create cohort"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-brand-light disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
