"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCohort, updateCohort } from "@/lib/admin/actions";

type Cohort = { id: string; name: string; description: string | null; starts_at: string | null; ends_at: string | null; memberCount: number };

export function CohortManager({ cohorts }: { cohorts: Cohort[] }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    start(async () => {
      await createCohort(name, desc || undefined, startsAt || undefined, endsAt || undefined);
      setName(""); setDesc(""); setStartsAt(""); setEndsAt("");
      setCreating(false);
      router.refresh();
    });
  };

  return (
    <div>
      {cohorts.length === 0 && !creating && (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
            <span className="text-xl">👥</span>
          </div>
          <h3 className="font-semibold text-brand-navy">No cohorts yet</h3>
          <p className="mt-1 text-sm text-neutral-600 max-w-sm mx-auto">
            Cohorts group learners who go through the program together. Create one to get started.
          </p>
        </div>
      )}

      {creating ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-brand-navy mb-3">New cohort</h3>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cohort name (e.g., Spring 2026)" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" autoFocus />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500">Start date</label>
                <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-neutral-500">End date</label>
                <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={pending || !name.trim()} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60">Create cohort</button>
              <button onClick={() => setCreating(false)} className="text-sm text-neutral-500">Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="mb-6 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
          + New cohort
        </button>
      )}

      {cohorts.length > 0 && (
        <div className="space-y-3">
          {cohorts.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-brand-navy">{c.name}</h3>
                  {c.description && <p className="mt-0.5 text-sm text-neutral-600">{c.description}</p>}
                  <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                    <span>{c.memberCount} member{c.memberCount !== 1 ? "s" : ""}</span>
                    {c.starts_at && <span>Starts {c.starts_at}</span>}
                    {c.ends_at && <span>Ends {c.ends_at}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
