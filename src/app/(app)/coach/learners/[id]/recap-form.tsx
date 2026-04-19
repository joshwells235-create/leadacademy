"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SubmitButton, TextInput } from "@/components/ui/form-field";
import { createSessionRecap } from "@/lib/coach/actions";
import { generateRecapDraft } from "@/lib/coach/recap-draft-action";

export function RecapForm({
  learnerId,
  hasAnyRecap,
  defaultSessionDate,
}: {
  learnerId: string;
  hasAnyRecap: boolean;
  defaultSessionDate: string;
}) {
  // Expanded by default the first time a coach writes a recap for a
  // learner — makes the empty state feel like a prompt rather than a
  // hidden form. Collapsed when history exists so previous recaps are
  // visible immediately below.
  const [open, setOpen] = useState(!hasAnyRecap);
  const [content, setContent] = useState("");
  const [sessionDate, setSessionDate] = useState(defaultSessionDate);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const router = useRouter();

  const handleGenerateDraft = () => {
    setError(undefined);
    startDraft(async () => {
      const res = await generateRecapDraft(learnerId, sessionDate);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setContent(res.draft);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    start(async () => {
      const res = await createSessionRecap(learnerId, content, sessionDate);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setContent("");
      setToast("Recap saved — learner can see it in their messages panel.");
      setTimeout(() => setToast(null), 4000);
      if (hasAnyRecap) setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          + Write recap
        </button>
        {toast && (
          <span role="status" className="text-xs text-emerald-700">
            {toast}
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-600">Session date:</span>
        <TextInput
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          aria-label="Session date"
          className="w-auto"
        />
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={drafting || pending}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand-blue/30 bg-brand-blue/5 px-2.5 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 disabled:opacity-60"
        >
          {drafting
            ? "Drafting…"
            : content
              ? "Regenerate draft"
              : "✨ AI-draft from learner activity"}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={7}
        placeholder="What was discussed, what they committed to, what's worth revisiting next session. e.g., Sarah committed to delegating the Q3 deck to Priya; we named her tendency to pre-edit; next session: check if Priya's draft felt good enough."
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
      <p className="text-[11px] text-neutral-500">
        Recap is visible to the learner and to anyone with read access to their record (their human
        coach and admins). Use <span className="font-medium">Your notes</span> above for anything
        private.
      </p>
      {error != null && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="w-auto">
          Save recap
        </SubmitButton>
        {hasAnyRecap && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
