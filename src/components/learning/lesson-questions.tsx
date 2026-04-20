"use client";

import { useState, useTransition } from "react";
import { askLessonQuestion, flagQuestionToCoach, markQuestionResolved } from "@/lib/qa/actions";

/**
 * LMS Phase D4 — "Ask the room" lesson-scoped Q&A.
 *
 * Learner types a question → thought partner answers immediately,
 * grounded in the lesson + their full context. If the answer lands,
 * the learner marks it resolved and moves on. If not, one click flags
 * the exchange to their coach for a human follow-up.
 *
 * Single-question exchanges by design (not threaded). The goal is to
 * unblock the learner in the moment; the chat surface handles anything
 * that needs a real back-and-forth.
 */

export type PriorQuestion = {
  id: string;
  question: string;
  aiAnswer: string | null;
  askedAt: string;
  flaggedToCoachAt: string | null;
  coachResponse: string | null;
  coachRespondedAt: string | null;
  resolvedAt: string | null;
};

type Props = {
  lessonId: string;
  initialQuestions: PriorQuestion[];
};

export function LessonQuestions({ lessonId, initialQuestions }: Props) {
  const [questions, setQuestions] = useState<PriorQuestion[]>(initialQuestions);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const q = draft.trim();
    if (q.length === 0 || pending) return;
    setErr(null);
    start(async () => {
      const res = await askLessonQuestion({ lessonId, question: q });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setQuestions((prev) => [
        {
          id: res.id,
          question: q,
          aiAnswer: res.answer,
          askedAt: new Date().toISOString(),
          flaggedToCoachAt: null,
          coachResponse: null,
          coachRespondedAt: null,
          resolvedAt: null,
        },
        ...prev,
      ]);
      setDraft("");
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Ask a question</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Your thought partner answers first, grounded in this lesson and what it knows about you.
            Still stuck after that? Flag it and your coach follows up.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="E.g. 'The feedback model here feels too rigid for my team — how would you adapt it?'"
          rows={3}
          disabled={pending}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-light"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-500">⌘↵ to send</span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || draft.trim().length === 0}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Thinking…" : "Ask"}
          </button>
        </div>
        {err && <p className="text-xs text-brand-pink">{err}</p>}
      </div>

      {questions.length > 0 && (
        <ul className="mt-5 space-y-4 border-t border-neutral-100 pt-4">
          {questions.map((q) => (
            <li key={q.id}>
              <QuestionRow
                q={q}
                onUpdate={(next) =>
                  setQuestions((prev) => prev.map((p) => (p.id === q.id ? next : p)))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionRow({
  q,
  onUpdate,
}: {
  q: PriorQuestion;
  onUpdate: (next: PriorQuestion) => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const flag = () => {
    start(async () => {
      setErr(null);
      const res = await flagQuestionToCoach(q.id);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      onUpdate({ ...q, flaggedToCoachAt: new Date().toISOString() });
    });
  };
  const resolve = () => {
    start(async () => {
      setErr(null);
      const res = await markQuestionResolved(q.id);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      onUpdate({ ...q, resolvedAt: new Date().toISOString() });
    });
  };

  const isResolved = !!q.resolvedAt;
  const isFlagged = !!q.flaggedToCoachAt;
  const hasCoachResponse = !!q.coachResponse;

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            You asked
          </span>
          <span className="text-[10px] text-neutral-400">
            {new Date(q.askedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          {isResolved && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
              Resolved
            </span>
          )}
          {isFlagged && !hasCoachResponse && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
              Waiting on coach
            </span>
          )}
          {hasCoachResponse && !isResolved && (
            <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 text-[10px] text-brand-pink">
              Coach replied
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-brand-navy whitespace-pre-wrap">{q.question}</p>
      </div>

      {q.aiAnswer && (
        <div className="rounded-md bg-brand-light px-3 py-2 text-sm text-neutral-800">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
            Thought partner
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{q.aiAnswer}</p>
        </div>
      )}

      {q.coachResponse && (
        <div className="rounded-md border border-brand-pink/30 bg-brand-pink/5 px-3 py-2 text-sm text-neutral-800">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-pink">
            Your coach
            {q.coachRespondedAt && (
              <span className="ml-2 font-normal text-neutral-400">
                {new Date(q.coachRespondedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{q.coachResponse}</p>
        </div>
      )}

      {!isResolved && (
        <div className="flex items-center justify-end gap-2 text-xs">
          {!isFlagged && !hasCoachResponse && (
            <button
              type="button"
              onClick={flag}
              disabled={pending}
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
            >
              Still stuck — flag to coach
            </button>
          )}
          <button
            type="button"
            onClick={resolve}
            disabled={pending}
            className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            That helped — mark resolved
          </button>
        </div>
      )}
      {err && <p className="text-right text-[11px] text-brand-pink">{err}</p>}
    </div>
  );
}
