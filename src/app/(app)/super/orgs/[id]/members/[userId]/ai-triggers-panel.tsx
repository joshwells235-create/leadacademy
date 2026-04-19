"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runMemoryDistillation, runNudgeDetection } from "@/lib/super/ai-trigger-actions";

export function AiTriggersPanel({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

  const runDistill = () => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await runMemoryDistillation(userId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(
        res.distilled > 0
          ? `Distilled ${res.distilled} conversation${res.distilled === 1 ? "" : "s"}.`
          : "Nothing pending to distill.",
      );
      router.refresh();
    });
  };

  const runNudge = () => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await runNudgeDetection(userId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(
        res.fired
          ? `Nudge fired: ${res.pattern}.`
          : "No nudge fired (rate limit, opt-out, or nothing detected).",
      );
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-navy mb-1">AI support triggers</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Manually kick off background AI processing for this learner. Useful when a normal
        user-triggered run didn't fire or produced wrong results.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runDistill}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-navy hover:bg-brand-light disabled:opacity-60"
        >
          Re-run memory distillation
        </button>
        <button
          type="button"
          onClick={runNudge}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-navy hover:bg-brand-light disabled:opacity-60"
        >
          Run nudge detection now
        </button>
      </div>
      {done && <p className="mt-2 text-xs text-emerald-700">{done}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
