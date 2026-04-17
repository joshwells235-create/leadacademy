"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionRecap } from "@/lib/coach/actions";
import { TextInput, SubmitButton } from "@/components/ui/form-field";

export function RecapForm({ learnerId }: { learnerId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
        + Write recap
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    start(async () => {
      const res = await createSessionRecap(learnerId, content, sessionDate);
      if ("error" in res) { setError(res.error); return; }
      setContent("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <TextInput type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="w-auto" />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="What was discussed, key insights, what was agreed..."
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
      {error != null && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="w-auto">Save recap</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">Cancel</button>
      </div>
    </form>
  );
}
