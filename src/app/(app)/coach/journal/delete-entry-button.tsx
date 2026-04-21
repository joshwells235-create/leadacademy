"use client";

import { useState, useTransition } from "react";
import { deleteJournalEntry } from "@/lib/coach/journal-actions";

export function DeleteEntryButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-neutral-600">Delete?</span>
        <button
          type="button"
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await deleteJournalEntry(id);
              if ("error" in res) setError(res.error);
            })
          }
          disabled={pending}
          className="rounded-md bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-2 py-0.5 text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
        {error && <span className="text-red-700">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-neutral-400 hover:text-red-700"
      aria-label="Delete entry"
    >
      Delete
    </button>
  );
}
