"use client";

import { useActionState, useRef } from "react";
import { createJournalEntry, type JournalActionResult } from "@/lib/coach/journal-actions";

export function JournalForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<JournalActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await createJournalEntry(prev, fd);
      if ("ok" in res && res.ok) formRef.current?.reset();
      return res;
    },
    null,
  );

  const fieldErrors = state && "fieldErrors" in state ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <label htmlFor="journal-content" className="block text-sm font-semibold text-brand-navy">
        A note for your own practice
      </label>
      <p className="mt-0.5 text-xs text-neutral-500">
        Patterns across your caseload, your own style choices, something you want to carry into
        next week. Your Thought Partner reads the last ten entries as context.
      </p>
      <textarea
        id="journal-content"
        name="content"
        rows={4}
        required
        placeholder="Noticing I keep gravitating to solutions with Chen. Want to practice sitting in the uncomfortable silence next time."
        className="mt-3 w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      {fieldErrors?.content && (
        <p className="mt-1 text-xs text-red-700">{fieldErrors.content.join(" ")}</p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          name="themes"
          type="text"
          placeholder="Themes, comma-separated (optional): presence, my-advising-habit"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <input
          name="entryDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save entry"}
        </button>
      </div>
      {state && "error" in state && (
        <p className="mt-2 text-xs text-red-700">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="mt-2 text-xs text-emerald-700">Saved.</p>
      )}
    </form>
  );
}
