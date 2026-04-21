"use client";

import { useState, useTransition } from "react";
import { generateSessionPrepDraft } from "@/lib/coach/prep-draft-action";

/**
 * Coach-facing session-prep panel. Collapsed by default; clicking the
 * button expands an editable textarea with an AI-drafted prep doc grounded
 * in the learner's activity since the coach's last recap.
 *
 * Ephemeral — no persistence. The coach reads it, maybe copies a line or
 * two into their own notes, and uses it as mental scaffolding walking into
 * the session. Pre-session is the "draft", the session itself is the work,
 * and the recap (separate tool) captures what actually happened.
 */
export function PrepDraftPanel({ learnerId }: { learnerId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setError(null);
    start(async () => {
      const res = await generateSessionPrepDraft(learnerId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setContent(res.draft);
    });
  };

  const handleOpen = () => {
    setOpen(true);
    if (!content && !pending) generate();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in some browsers — no-op, coach can select-all + copy manually.
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-md border border-brand-blue/30 bg-white px-3 py-1.5 text-sm font-medium text-brand-blue transition hover:bg-brand-blue hover:text-white"
      >
        <span aria-hidden>✨</span>
        Draft session prep
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-brand-navy">Session prep — draft</p>
          <p className="text-xs text-neutral-600">
            Pulled from this coachee's activity since your last recap. Edit or copy as needed;
            this isn't saved anywhere.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="rounded-md border border-brand-blue/30 bg-white px-2.5 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 disabled:opacity-60"
          >
            {pending ? "Drafting…" : content ? "Regenerate" : "Draft"}
          </button>
          {content && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
      </div>
      <textarea
        value={pending && !content ? "Drafting prep from this coachee's recent activity…" : content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={pending && !content}
        rows={12}
        aria-label="Session prep draft"
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-800 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
