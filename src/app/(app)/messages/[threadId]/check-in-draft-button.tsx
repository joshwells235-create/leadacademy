"use client";

import { useState, useTransition } from "react";
import { generateCheckInDraft } from "@/lib/coach/check-in-draft-action";
import { sendMessage } from "@/lib/messages/actions";

/**
 * Coach-only CTA on a DM thread with one of their coachees. Clicking it
 * asks the Thought Partner for a first-draft check-in message grounded in
 * the coachee's recent activity. Coach reviews and edits in-place, then
 * sends via the existing sendMessage action — the thread's Realtime
 * subscription renders the new message.
 */
export function CheckInDraftButton({
  learnerId,
  threadId,
}: {
  learnerId: string;
  threadId: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [drafting, startDraft] = useTransition();
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setError(null);
    startDraft(async () => {
      const res = await generateCheckInDraft(learnerId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDraft(res.draft);
    });
  };

  const handleOpen = () => {
    setOpen(true);
    if (!draft && !drafting) generate();
  };

  const handleSend = () => {
    if (!draft.trim() || sending) return;
    setError(null);
    startSend(async () => {
      const res = await sendMessage(threadId, draft.trim());
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDraft("");
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-md border border-brand-blue/30 bg-white px-3 py-1.5 text-sm font-medium text-brand-blue transition hover:bg-brand-blue hover:text-white"
      >
        <span aria-hidden>✨</span>
        Draft check-in
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-4 shadow-sm sm:w-[420px]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-brand-navy">Check-in draft</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={generate}
            disabled={drafting || sending}
            className="rounded-md border border-brand-blue/30 bg-white px-2 py-0.5 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 disabled:opacity-60"
          >
            {drafting ? "Drafting…" : draft ? "Regenerate" : "Draft"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={sending}
            className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            Close
          </button>
        </div>
      </div>
      <textarea
        value={
          drafting && !draft ? "Drafting a check-in from this coachee's recent activity…" : draft
        }
        onChange={(e) => setDraft(e.target.value)}
        readOnly={drafting && !draft}
        rows={6}
        aria-label="Check-in draft"
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || drafting || !draft.trim()}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send check-in"}
        </button>
      </div>
    </div>
  );
}
