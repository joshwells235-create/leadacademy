"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { superAssignCoach } from "@/lib/super/user-actions";

type CoachCandidate = { user_id: string; display_name: string | null };

export function SuperCoachPanel({
  learnerUserId,
  currentCoachUserId,
  currentCoachName,
  candidates,
}: {
  learnerUserId: string;
  currentCoachUserId: string | null;
  currentCoachName: string | null;
  candidates: CoachCandidate[];
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<string>(currentCoachUserId ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const changed = (selection || null) !== (currentCoachUserId ?? null);

  const save = () => {
    setError(null);
    start(async () => {
      const res = await superAssignCoach(learnerUserId, selection || null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-brand-navy">Coach</h2>
      <p className="mb-3 text-[11px] text-neutral-500">
        {currentCoachName
          ? `Currently assigned: ${currentCoachName}`
          : "No coach assigned."}
      </p>

      <div className="flex items-center gap-2">
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Coach"
        >
          <option value="">— No coach —</option>
          {candidates.map((c) => (
            <option key={c.user_id} value={c.user_id}>
              {c.display_name ?? "Unnamed"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={!changed || pending}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      {candidates.length === 0 && (
        <p className="mt-2 text-[11px] text-neutral-500">
          No coaches in this org yet. Invite someone with the coach role from the org page first.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
