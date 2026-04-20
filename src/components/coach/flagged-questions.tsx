"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { coachRespondToQuestion } from "@/lib/qa/actions";

/**
 * LMS Phase D4 — coach-facing panel for questions a learner flagged.
 *
 * Shows the learner's question + the AI's attempt + (if already given)
 * the coach's response. The coach types a reply inline; on save, the
 * learner gets a notification and the row shows "Coach replied".
 *
 * Unresolved-flagged questions land at the top; answered ones drop
 * below. Already-resolved ones are hidden (the learner moved on).
 */

export type CoachFlaggedQuestion = {
  id: string;
  learnerUserId: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string | null;
  courseTitle: string | null;
  question: string;
  aiAnswer: string | null;
  askedAt: string;
  flaggedAt: string;
  coachResponse: string | null;
  coachRespondedAt: string | null;
};

export function FlaggedQuestions({ rows }: { rows: CoachFlaggedQuestion[] }) {
  if (rows.length === 0) {
    return (
      <section
        id="questions"
        className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold">Flagged questions</h2>
        <p className="mt-1 text-xs text-neutral-500">
          When your learner is stuck after their thought partner's first-pass answer, they flag the
          question here for you. Nothing flagged right now.
        </p>
      </section>
    );
  }

  // Waiting-on-coach first, then already-responded.
  const waiting = rows.filter((r) => !r.coachRespondedAt);
  const responded = rows.filter((r) => r.coachRespondedAt);

  return (
    <section id="questions" className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">
        Flagged questions
        {waiting.length > 0 && (
          <span className="ml-2 rounded-full bg-brand-pink/10 px-2 py-0.5 text-[11px] font-medium text-brand-pink">
            {waiting.length} waiting
          </span>
        )}
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Questions your learner flagged for a human take. Your response shows up inline in the lesson
        and triggers a notification.
      </p>

      <ul className="mt-4 space-y-5">
        {[...waiting, ...responded].map((q) => (
          <li key={q.id}>
            <FlaggedQuestionRow row={q} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlaggedQuestionRow({ row }: { row: CoachFlaggedQuestion }) {
  const [draft, setDraft] = useState(row.coachResponse ?? "");
  const [saved, setSaved] = useState<string | null>(row.coachResponse);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const dirty = draft.trim() !== (saved ?? "").trim();

  const submit = () => {
    const text = draft.trim();
    if (text.length === 0 || pending) return;
    setErr(null);
    start(async () => {
      const res = await coachRespondToQuestion({ questionId: row.id, response: text });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setSaved(text);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        <span>
          Asked{" "}
          {new Date(row.askedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <span aria-hidden>·</span>
        <span>
          Flagged{" "}
          {new Date(row.flaggedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        {row.courseId && row.courseTitle && (
          <>
            <span aria-hidden>·</span>
            <Link
              href={`/learning/${row.courseId}/${row.lessonId}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-blue hover:underline"
            >
              {row.courseTitle} / {row.lessonTitle} ↗
            </Link>
          </>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          Learner's question
        </p>
        <p className="mt-0.5 text-sm text-brand-navy whitespace-pre-wrap">{row.question}</p>
      </div>

      {row.aiAnswer && (
        <div className="rounded-md bg-brand-light px-3 py-2 text-xs text-neutral-700">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
            Thought partner answered
          </p>
          <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{row.aiAnswer}</p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-pink">
          Your response
          {row.coachRespondedAt && (
            <span className="ml-2 font-normal text-neutral-400">
              saved{" "}
              {new Date(row.coachRespondedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
          rows={3}
          disabled={pending}
          placeholder="Write the response they'll see under the AI answer in their lesson."
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-light"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-500">Saves immediately on click.</span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !dirty || draft.trim().length === 0}
            className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : row.coachResponse ? "Update response" : "Send response"}
          </button>
        </div>
        {err && <p className="mt-1 text-[11px] text-brand-pink">{err}</p>}
      </div>
    </div>
  );
}
