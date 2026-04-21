"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { QuestionType } from "@/lib/learning/quiz-actions";
import { submitQuizAttempt } from "@/lib/learning/quiz-actions";

export type PlayerQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  order: number;
  config: Record<string, unknown>;
};

export type PlayerSettings = {
  pass_percent: number;
  max_attempts: number | null;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  instructions: string | null;
};

type Props = {
  lessonId: string;
  settings: PlayerSettings;
  questions: PlayerQuestion[];
  priorAttemptsCount: number;
  lastAttempt: {
    score_percent: number | null;
    passed: boolean | null;
    attempt_number: number;
    completed_at: string | null;
    answers: Record<string, unknown> | null;
  } | null;
};

type Response = unknown;

export function QuizPlayer({
  lessonId,
  settings,
  questions,
  priorAttemptsCount,
  lastAttempt,
}: Props) {
  const shuffledQuestions = useMemo(() => {
    if (!settings.shuffle_questions) return questions;
    return [...questions].sort(() => Math.random() - 0.5);
  }, [questions, settings.shuffle_questions]);

  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [submitted, setSubmitted] = useState<null | {
    scorePercent: number;
    passed: boolean;
    perQuestion: Record<
      string,
      { correct: boolean; points_earned: number; correct_answer?: unknown }
    >;
  }>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const attemptsUsed = priorAttemptsCount + (submitted ? 1 : 0);
  const attemptsRemaining =
    settings.max_attempts !== null ? Math.max(0, settings.max_attempts - attemptsUsed) : null;
  const canAttempt = attemptsRemaining === null || attemptsRemaining > 0;
  const alreadyPassed = !!lastAttempt?.passed;

  const submit = () => {
    setError(null);
    start(async () => {
      const payload: Record<string, { response: unknown }> = {};
      for (const q of shuffledQuestions) {
        payload[q.id] = { response: responses[q.id] ?? null };
      }
      const res = await submitQuizAttempt(lessonId, payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSubmitted({
        scorePercent: res.scorePercent,
        passed: res.passed,
        perQuestion: res.perQuestion,
      });
      router.refresh();
    });
  };

  const reset = () => {
    setResponses({});
    setSubmitted(null);
    setError(null);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500">
        This quiz has no questions yet. Check back later.
      </div>
    );
  }

  if (alreadyPassed && !submitted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-800">
          ✓ You passed this quiz on attempt {lastAttempt?.attempt_number} with{" "}
          {lastAttempt?.score_percent}%.
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          You've completed this lesson. Head to the next lesson — you can also retake the quiz to
          sharpen your understanding.
        </p>
        {canAttempt && (
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-md border border-emerald-400 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          >
            Retake for practice
          </button>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <QuizResults
        result={submitted}
        settings={settings}
        questions={shuffledQuestions}
        responses={responses}
        attemptsRemaining={attemptsRemaining}
        onRetry={reset}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-brand-blue/30 bg-brand-blue-light/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-navy">Quiz</h2>
        <p className="mt-1 text-xs text-neutral-600">
          {questions.length} question{questions.length === 1 ? "" : "s"} · Pass at{" "}
          {settings.pass_percent}% or higher to complete this lesson.
          {settings.max_attempts !== null && (
            <>
              {" "}
              Attempts remaining:{" "}
              <strong>
                {attemptsRemaining}/{settings.max_attempts}
              </strong>
              .
            </>
          )}
        </p>
        {settings.instructions && (
          <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">
            {settings.instructions}
          </p>
        )}
      </div>

      {!canAttempt ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          You've used all {settings.max_attempts} attempts on this quiz. Contact your program admin
          if you need another try.
        </div>
      ) : (
        <>
          <ol className="space-y-5">
            {shuffledQuestions.map((q, i) => (
              <li
                key={q.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-medium text-neutral-500">
                    Question {i + 1} of {shuffledQuestions.length}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {q.points} pt{q.points !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm text-brand-navy mb-3 whitespace-pre-wrap">{q.prompt}</p>
                <QuestionInput
                  question={q}
                  response={responses[q.id]}
                  onChange={(next) => setResponses((prev) => ({ ...prev, [q.id]: next }))}
                />
              </li>
            ))}
          </ol>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">
              {Object.keys(responses).length} of {shuffledQuestions.length} answered.
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={pending || Object.keys(responses).length === 0}
              className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Submit quiz"}
            </button>
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type input
// ---------------------------------------------------------------------------

function QuestionInput({
  question,
  response,
  onChange,
}: {
  question: PlayerQuestion;
  response: Response;
  onChange: (next: Response) => void;
}) {
  const { type, config } = question;

  if (type === "single_choice") {
    const options = (config.options as Array<{ id: string; text: string }>) ?? [];
    return (
      <div className="space-y-1.5">
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer ${
              response === o.id
                ? "border-brand-blue bg-brand-blue/5"
                : "border-neutral-200 hover:border-brand-blue/50"
            }`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={response === o.id}
              onChange={() => onChange(o.id)}
              className="mt-1"
            />
            <span className="text-sm text-neutral-800">{o.text}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "multi_choice") {
    const options = (config.options as Array<{ id: string; text: string }>) ?? [];
    const selected: string[] = Array.isArray(response) ? (response as string[]) : [];
    const toggle = (id: string) => {
      const set = new Set(selected);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      onChange(Array.from(set));
    };
    return (
      <div className="space-y-1.5">
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer ${
              selected.includes(o.id)
                ? "border-brand-blue bg-brand-blue/5"
                : "border-neutral-200 hover:border-brand-blue/50"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => toggle(o.id)}
              className="mt-1"
            />
            <span className="text-sm text-neutral-800">{o.text}</span>
          </label>
        ))}
        <p className="mt-1 text-[11px] text-neutral-500">Select all that apply.</p>
      </div>
    );
  }

  if (type === "true_false") {
    return (
      <div className="flex gap-2">
        {[true, false].map((val) => (
          <label
            key={String(val)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-2 cursor-pointer ${
              response === val
                ? "border-brand-blue bg-brand-blue/5"
                : "border-neutral-200 hover:border-brand-blue/50"
            }`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={response === val}
              onChange={() => onChange(val)}
            />
            <span className="text-sm font-medium text-neutral-800">{val ? "True" : "False"}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "short_answer") {
    return (
      <input
        type="text"
        value={(response as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer…"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
    );
  }

  if (type === "matching") {
    return <MatchingInput question={question} response={response} onChange={onChange} />;
  }

  if (type === "ordering") {
    const items = (config.items as Array<{ id: string; text: string }>) ?? [];
    const orderIds: string[] =
      Array.isArray(response) && response.length === items.length
        ? (response as string[])
        : items.map((i) => i.id);
    const byId = new Map(items.map((i) => [i.id, i.text]));
    const move = (i: number, direction: "up" | "down") => {
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= orderIds.length) return;
      const next = orderIds.slice();
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-neutral-500">Put these in the right order.</p>
        <ul className="space-y-1.5">
          {orderIds.map((id, i) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5"
            >
              <span className="text-xs text-neutral-400 w-6">{i + 1}.</span>
              <span className="flex-1 text-sm text-neutral-800">{byId.get(id)}</span>
              <button
                type="button"
                onClick={() => move(i, "up")}
                disabled={i === 0}
                aria-label="Move up"
                className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500 hover:text-brand-blue disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, "down")}
                disabled={i === orderIds.length - 1}
                aria-label="Move down"
                className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500 hover:text-brand-blue disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}

function MatchingInput({
  question,
  response,
  onChange,
}: {
  question: PlayerQuestion;
  response: Response;
  onChange: (next: Response) => void;
}) {
  const pairs = (question.config.pairs as Array<{ id: string; left: string; right: string }>) ?? [];
  const rightOptions = useMemo(
    () => pairs.map((p) => p.right).sort(() => Math.random() - 0.5),
    [pairs],
  );
  const answers = (response as Record<string, string> | undefined) ?? {};
  const setAnswer = (pairId: string, value: string) => {
    onChange({ ...answers, [pairId]: value });
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-neutral-500">
        Match each item on the left to one on the right.
      </p>
      <ul className="space-y-1.5">
        {pairs.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-neutral-800">{p.left}</span>
            <span className="text-neutral-400">→</span>
            <select
              value={answers[p.id] ?? ""}
              onChange={(e) => setAnswer(p.id, e.target.value)}
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="">— pick a match —</option>
              {rightOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function QuizResults({
  result,
  settings,
  questions,
  responses,
  attemptsRemaining,
  onRetry,
}: {
  result: {
    scorePercent: number;
    passed: boolean;
    perQuestion: Record<
      string,
      { correct: boolean; points_earned: number; correct_answer?: unknown }
    >;
  };
  settings: PlayerSettings;
  questions: PlayerQuestion[];
  responses: Record<string, Response>;
  attemptsRemaining: number | null;
  onRetry: () => void;
}) {
  const canRetry = attemptsRemaining === null || attemptsRemaining > 0;
  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-5 ${
          result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{result.passed ? "🎉" : "💪"}</span>
          <h2
            className={`text-lg font-bold ${result.passed ? "text-emerald-900" : "text-amber-900"}`}
          >
            {result.passed ? "You passed!" : "Not quite yet"}
          </h2>
        </div>
        <p className={`text-sm ${result.passed ? "text-emerald-800" : "text-amber-800"}`}>
          You scored <strong>{result.scorePercent}%</strong> — the pass threshold is{" "}
          {settings.pass_percent}%.
          {result.passed
            ? " This lesson is marked complete. Keep going!"
            : canRetry
              ? " Review the feedback below and try again when you're ready."
              : " You've used all your attempts. Reach out to your program admin for another try."}
        </p>
        {!result.passed && canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
          >
            Retry quiz
          </button>
        )}
      </div>

      {settings.show_correct_answers && (
        <ol className="space-y-3">
          {questions.map((q, i) => {
            const r = result.perQuestion[q.id];
            const userResponse = responses[q.id];
            return (
              <li
                key={q.id}
                className={`rounded-lg border p-4 ${
                  r?.correct ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-medium text-neutral-500">Q{i + 1}</span>
                  <span
                    className={`text-[10px] font-medium ${
                      r?.correct ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {r?.correct ? "Correct" : "Incorrect"} · {r?.points_earned ?? 0}/{q.points} pt
                    {q.points !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm text-brand-navy mb-2">{q.prompt}</p>
                <ResultDisplay
                  question={q}
                  userResponse={userResponse}
                  correct={r?.correct ?? false}
                />
                {q.explanation && (
                  <p className="mt-2 rounded-md bg-white px-2 py-1.5 text-[11px] text-neutral-700 italic">
                    💡 {q.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ResultDisplay({
  question,
  userResponse,
  correct,
}: {
  question: PlayerQuestion;
  userResponse: Response;
  correct: boolean;
}) {
  const { type, config } = question;

  if (type === "single_choice" || type === "multi_choice") {
    const options =
      (config.options as Array<{ id: string; text: string; feedback?: string }>) ?? [];
    const correctIds = new Set(
      type === "single_choice"
        ? [(config.correct_option_id as string) ?? ""]
        : ((config.correct_option_ids as string[]) ?? []),
    );
    const userIds = new Set(
      type === "single_choice"
        ? typeof userResponse === "string"
          ? [userResponse]
          : []
        : Array.isArray(userResponse)
          ? (userResponse as string[])
          : [],
    );
    return (
      <ul className="space-y-0.5 text-xs">
        {options.map((o) => {
          const isCorrect = correctIds.has(o.id);
          const isUser = userIds.has(o.id);
          return (
            <li key={o.id} className="flex items-start gap-1.5">
              <span
                className={`font-semibold ${
                  isCorrect ? "text-emerald-600" : isUser ? "text-red-600" : "text-neutral-400"
                }`}
              >
                {isCorrect ? "✓" : isUser ? "✗" : "○"}
              </span>
              <div>
                <span className="text-neutral-700">{o.text}</span>
                {isUser && !isCorrect && o.feedback && (
                  <span className="block text-[11px] text-neutral-500 mt-0.5">{o.feedback}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (type === "true_false") {
    const userVal = typeof userResponse === "boolean" ? userResponse : null;
    const correctVal = config.correct as boolean;
    const feedback =
      userVal === true
        ? (config.true_feedback as string | undefined)
        : userVal === false
          ? (config.false_feedback as string | undefined)
          : null;
    return (
      <div className="text-xs">
        <p>
          Your answer:{" "}
          <span
            className={correct ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}
          >
            {userVal === null ? "(no answer)" : userVal ? "True" : "False"}
          </span>
          {!correct && (
            <>
              {" · Correct answer: "}
              <span className="text-emerald-700 font-semibold">
                {correctVal ? "True" : "False"}
              </span>
            </>
          )}
        </p>
        {feedback && <p className="mt-1 text-neutral-500">{feedback}</p>}
      </div>
    );
  }

  if (type === "short_answer") {
    const answers = (config.acceptable_answers as string[]) ?? [];
    return (
      <div className="text-xs">
        <p>
          Your answer:{" "}
          <span
            className={correct ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}
          >
            {typeof userResponse === "string" ? userResponse : "(no answer)"}
          </span>
        </p>
        {!correct && (
          <p className="mt-1 text-neutral-500">Accepted answers: {answers.join(" · ")}</p>
        )}
      </div>
    );
  }

  if (type === "matching") {
    const pairs = (config.pairs as Array<{ id: string; left: string; right: string }>) ?? [];
    const responseMap = (userResponse as Record<string, string>) ?? {};
    return (
      <ul className="space-y-0.5 text-xs">
        {pairs.map((p) => {
          const picked = responseMap[p.id] ?? "";
          const right = p.right;
          const ok = picked.trim() === right.trim();
          return (
            <li key={p.id} className="flex items-center gap-2">
              <span className="font-medium">{p.left}</span>
              <span className="text-neutral-400">→</span>
              <span className={ok ? "text-emerald-700" : "text-red-700"}>{picked || "(none)"}</span>
              {!ok && <span className="text-neutral-500">(correct: {right})</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  if (type === "ordering") {
    const items = (config.items as Array<{ id: string; text: string }>) ?? [];
    const byId = new Map(items.map((i) => [i.id, i.text]));
    const userOrder = Array.isArray(userResponse) ? (userResponse as string[]) : [];
    return (
      <div className="text-xs">
        <p className="mb-1 text-neutral-500">Your order:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          {userOrder.map((id, i) => {
            const ok = items[i]?.id === id;
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: ordering index is the meaning
                key={i}
                className={ok ? "text-emerald-700" : "text-red-700"}
              >
                {byId.get(id) ?? id}
              </li>
            );
          })}
        </ol>
        {!correct && (
          <>
            <p className="mt-2 mb-1 text-neutral-500">Correct order:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-neutral-700">
              {items.map((it) => (
                <li key={it.id}>{it.text}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    );
  }

  return null;
}
