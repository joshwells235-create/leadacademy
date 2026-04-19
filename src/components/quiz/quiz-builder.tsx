"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import {
  createQuizQuestion,
  deleteQuizQuestion,
  moveQuizQuestion,
  type QuestionType,
  updateQuizQuestion,
  upsertQuizSettings,
} from "@/lib/learning/quiz-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuizQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  order: number;
  config: Record<string, unknown>;
};

export type QuizSettings = {
  pass_percent: number;
  max_attempts: number | null;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  instructions: string | null;
};

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multi_choice: "Multi-select",
  true_false: "True / False",
  short_answer: "Short answer",
  matching: "Matching",
  ordering: "Ordering",
};

const QUESTION_TYPE_DESCRIPTION: Record<QuestionType, string> = {
  single_choice: "Pick one correct option from 2+ choices.",
  multi_choice: "Select all correct options (must match exactly).",
  true_false: "A single T/F question with optional feedback per answer.",
  short_answer: "Free text; accept a list of correct answers (case-optional).",
  matching: "Match items on the left to items on the right.",
  ordering: "Arrange items into the correct sequence.",
};

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function QuizBuilder({
  lessonId,
  settings,
  questions: initialQuestions,
}: {
  lessonId: string;
  settings: QuizSettings | null;
  questions: QuizQuestion[];
}) {
  return (
    <div className="rounded-lg border border-brand-pink/30 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 text-xs font-semibold text-brand-pink">
          Quiz
        </span>
        <h2 className="text-sm font-semibold text-brand-navy">Questions & settings</h2>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Questions render as a guided flow to the learner. Pass the configured % to mark the lesson
        complete. The Tiptap content above serves as the quiz intro.
      </p>

      <QuizSettingsPanel lessonId={lessonId} settings={settings} />

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy">Questions</h3>
        {initialQuestions.length === 0 ? (
          <p className="text-xs text-neutral-500">No questions yet. Add one below.</p>
        ) : (
          <ul className="space-y-2">
            {initialQuestions.map((q, idx) => (
              <QuestionRow
                key={q.id}
                question={q}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === initialQuestions.length - 1}
              />
            ))}
          </ul>
        )}
      </div>

      <AddQuestionButton lessonId={lessonId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function QuizSettingsPanel({
  lessonId,
  settings,
}: {
  lessonId: string;
  settings: QuizSettings | null;
}) {
  const [passPercent, setPassPercent] = useState<string>((settings?.pass_percent ?? 80).toString());
  const [maxAttempts, setMaxAttempts] = useState<string>(settings?.max_attempts?.toString() ?? "");
  const [shuffle, setShuffle] = useState(settings?.shuffle_questions ?? false);
  const [showAnswers, setShowAnswers] = useState(settings?.show_correct_answers ?? true);
  const [instructions, setInstructions] = useState(settings?.instructions ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const save = () => {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await upsertQuizSettings(lessonId, {
        passPercent: Math.max(0, Math.min(100, Number.parseInt(passPercent, 10) || 80)),
        maxAttempts: maxAttempts.trim() ? Number.parseInt(maxAttempts, 10) : null,
        shuffleQuestions: shuffle,
        showCorrectAnswers: showAnswers,
        instructions: instructions.trim(),
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-brand-light/40 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="block text-[11px] font-medium text-neutral-600 mb-1">
            Pass % (must score at or above to mark complete)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={passPercent}
            onChange={(e) => setPassPercent(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-neutral-600 mb-1">
            Max attempts (blank = unlimited)
          </span>
          <input
            type="number"
            min={1}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
            placeholder="unlimited"
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          Shuffle question order for each attempt
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={showAnswers}
            onChange={(e) => setShowAnswers(e.target.checked)}
          />
          Show correct answers in results
        </label>
      </div>
      <label className="block mt-3">
        <span className="block text-[11px] font-medium text-neutral-600 mb-1">
          Instructions (optional)
        </span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="Read the intro above first. You can retry if you don't pass the first time."
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-xs text-emerald-700">✓ Saved</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question row (existing question, view + edit)
// ---------------------------------------------------------------------------

function QuestionRow({
  question,
  index,
  isFirst,
  isLast,
}: {
  question: QuizQuestion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const runDelete = () => {
    start(async () => {
      await deleteQuizQuestion(question.id);
      setConfirming(false);
      router.refresh();
    });
  };

  const runMove = (direction: "up" | "down") => {
    start(async () => {
      await moveQuizQuestion(question.id, direction);
      router.refresh();
    });
  };

  if (editing) {
    return <QuestionForm existing={question} onClose={() => setEditing(false)} />;
  }

  return (
    <li className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-neutral-500">Q{index + 1}</span>
            <span className="rounded-full bg-brand-pink/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-pink">
              {QUESTION_TYPE_LABEL[question.type]}
            </span>
            <span className="text-[10px] text-neutral-500">
              {question.points} pt{question.points !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-neutral-800">{question.prompt}</p>
          <QuestionSummary question={question} />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => runMove("up")}
              disabled={isFirst || pending}
              aria-label="Move up"
              className="text-[10px] text-neutral-400 hover:text-brand-blue disabled:opacity-30 px-1"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => runMove("down")}
              disabled={isLast || pending}
              aria-label="Move down"
              className="text-[10px] text-neutral-400 hover:text-brand-blue disabled:opacity-30 px-1"
            >
              ↓
            </button>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-brand-blue hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-brand-pink hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
      {confirming && (
        <div className="mt-3">
          <ConfirmBlock
            title="Delete this question?"
            tone="destructive"
            confirmLabel="Delete"
            pending={pending}
            onCancel={() => setConfirming(false)}
            onConfirm={runDelete}
          >
            Removes the question. Past attempt records preserve the answer given but will no longer
            reference an existing question.
          </ConfirmBlock>
        </div>
      )}
    </li>
  );
}

function QuestionSummary({ question }: { question: QuizQuestion }) {
  const { type, config } = question;
  if (type === "single_choice" || type === "multi_choice") {
    const opts = (config.options as Array<{ id: string; text: string }>) ?? [];
    const correct = new Set(
      type === "single_choice"
        ? [(config.correct_option_id as string) ?? ""]
        : ((config.correct_option_ids as string[]) ?? []),
    );
    return (
      <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
        {opts.map((o) => (
          <li key={o.id} className="flex items-start gap-1.5">
            <span
              className={correct.has(o.id) ? "text-emerald-600 font-semibold" : "text-neutral-400"}
            >
              {correct.has(o.id) ? "✓" : "○"}
            </span>
            <span>{o.text}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (type === "true_false") {
    const correct = config.correct as boolean;
    return (
      <p className="mt-2 text-xs text-neutral-600">
        Correct answer:{" "}
        <span className="text-emerald-600 font-semibold">{correct ? "True" : "False"}</span>
      </p>
    );
  }
  if (type === "short_answer") {
    const answers = (config.acceptable_answers as string[]) ?? [];
    return (
      <p className="mt-2 text-xs text-neutral-600">
        Accepts: <span className="text-neutral-800">{answers.join(" · ")}</span>
        {config.case_sensitive ? " (case-sensitive)" : ""}
      </p>
    );
  }
  if (type === "matching") {
    const pairs = (config.pairs as Array<{ left: string; right: string }>) ?? [];
    return (
      <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
        {pairs.map((p) => (
          <li key={p.left}>
            <span className="font-medium">{p.left}</span> → {p.right}
          </li>
        ))}
      </ul>
    );
  }
  if (type === "ordering") {
    const items = (config.items as Array<{ text: string }>) ?? [];
    return (
      <ol className="mt-2 list-decimal list-inside text-xs text-neutral-600">
        {items.map((i) => (
          <li key={i.text}>{i.text}</li>
        ))}
      </ol>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Add question button + form
// ---------------------------------------------------------------------------

function AddQuestionButton({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return <QuestionForm lessonId={lessonId} onClose={() => setOpen(false)} />;
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-4 w-full rounded-lg border-2 border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 hover:border-brand-blue hover:text-brand-blue transition"
    >
      + Add question
    </button>
  );
}

function defaultConfigFor(type: QuestionType): Record<string, unknown> {
  const sharedId = () => Math.random().toString(36).slice(2, 10);
  if (type === "single_choice") {
    const a = sharedId();
    const b = sharedId();
    return {
      options: [
        { id: a, text: "", feedback: "" },
        { id: b, text: "", feedback: "" },
      ],
      correct_option_id: a,
    };
  }
  if (type === "multi_choice") {
    const a = sharedId();
    const b = sharedId();
    return {
      options: [
        { id: a, text: "", feedback: "" },
        { id: b, text: "", feedback: "" },
      ],
      correct_option_ids: [a],
    };
  }
  if (type === "true_false") {
    return { correct: true, true_feedback: "", false_feedback: "" };
  }
  if (type === "short_answer") {
    return { acceptable_answers: [""], case_sensitive: false };
  }
  if (type === "matching") {
    return {
      pairs: [
        { id: sharedId(), left: "", right: "" },
        { id: sharedId(), left: "", right: "" },
      ],
    };
  }
  if (type === "ordering") {
    return {
      items: [
        { id: sharedId(), text: "" },
        { id: sharedId(), text: "" },
      ],
    };
  }
  return {};
}

function QuestionForm({
  lessonId,
  existing,
  onClose,
}: {
  lessonId?: string;
  existing?: QuizQuestion;
  onClose: () => void;
}) {
  const [type, setType] = useState<QuestionType>(existing?.type ?? "single_choice");
  const [prompt, setPrompt] = useState(existing?.prompt ?? "");
  const [explanation, setExplanation] = useState(existing?.explanation ?? "");
  const [points, setPoints] = useState((existing?.points ?? 1).toString());
  const [config, setConfig] = useState<Record<string, unknown>>(
    existing?.config ?? defaultConfigFor("single_choice"),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onTypeChange = (next: QuestionType) => {
    setType(next);
    setConfig(defaultConfigFor(next));
  };

  const save = () => {
    setError(null);
    start(async () => {
      const payload = {
        type,
        prompt: prompt.trim(),
        explanation: explanation.trim() || undefined,
        points: Math.max(1, Number.parseInt(points, 10) || 1),
        config,
      };
      const res = existing
        ? await updateQuizQuestion(existing.id, payload)
        : lessonId
          ? await createQuizQuestion(lessonId, payload)
          : { error: "Missing lesson id." };
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-4">
      <h4 className="text-sm font-semibold text-brand-navy mb-3">
        {existing ? "Edit question" : "New question"}
      </h4>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Type</span>
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as QuestionType)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-neutral-500">
            {QUESTION_TYPE_DESCRIPTION[type]}
          </span>
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="What do you want the learner to think about?"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Points</span>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">
            Explanation (shown after submit, optional)
          </span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            placeholder="Why is the correct answer correct? Optional but recommended for learning."
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-4">
        <TypeSpecificEditor type={type} config={config} onChange={setConfig} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !prompt.trim()}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : existing ? "Save question" : "Add question"}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-neutral-500">
          Cancel
        </button>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type editors
// ---------------------------------------------------------------------------

function TypeSpecificEditor({
  type,
  config,
  onChange,
}: {
  type: QuestionType;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (type === "single_choice") {
    return <SingleChoiceEditor config={config} onChange={onChange} />;
  }
  if (type === "multi_choice") {
    return <MultiChoiceEditor config={config} onChange={onChange} />;
  }
  if (type === "true_false") {
    return <TrueFalseEditor config={config} onChange={onChange} />;
  }
  if (type === "short_answer") {
    return <ShortAnswerEditor config={config} onChange={onChange} />;
  }
  if (type === "matching") {
    return <MatchingEditor config={config} onChange={onChange} />;
  }
  if (type === "ordering") {
    return <OrderingEditor config={config} onChange={onChange} />;
  }
  return null;
}

type EditorProps = {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

function newOptionId() {
  return Math.random().toString(36).slice(2, 10);
}

function SingleChoiceEditor({ config, onChange }: EditorProps) {
  const options = (config.options as Array<{ id: string; text: string; feedback?: string }>) ?? [];
  const correctId = (config.correct_option_id as string) ?? "";

  const updateOption = (id: string, patch: Partial<{ text: string; feedback: string }>) => {
    onChange({
      ...config,
      options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };

  const addOption = () => {
    const id = newOptionId();
    onChange({
      ...config,
      options: [...options, { id, text: "", feedback: "" }],
    });
  };

  const removeOption = (id: string) => {
    const nextOptions = options.filter((o) => o.id !== id);
    onChange({
      ...config,
      options: nextOptions,
      correct_option_id: correctId === id ? (nextOptions[0]?.id ?? "") : correctId,
    });
  };

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-2">
        Options (pick exactly one correct)
      </p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.id} className="flex items-start gap-2">
            <input
              type="radio"
              name="correct-single"
              checked={correctId === o.id}
              onChange={() => onChange({ ...config, correct_option_id: o.id })}
              className="mt-2"
              aria-label="Correct answer"
            />
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={o.text}
                onChange={(e) => updateOption(o.id, { text: e.target.value })}
                placeholder="Option text"
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={o.feedback ?? ""}
                onChange={(e) => updateOption(o.id, { feedback: e.target.value })}
                placeholder="Feedback shown if picked (optional)"
                className="w-full rounded-md border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600"
              />
            </div>
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(o.id)}
                className="text-xs text-neutral-400 hover:text-brand-pink"
                aria-label="Remove option"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addOption}
        className="mt-2 text-xs text-brand-blue hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}

function MultiChoiceEditor({ config, onChange }: EditorProps) {
  const options = (config.options as Array<{ id: string; text: string; feedback?: string }>) ?? [];
  const correctIds = new Set((config.correct_option_ids as string[]) ?? []);

  const toggleCorrect = (id: string) => {
    const next = new Set(correctIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...config, correct_option_ids: Array.from(next) });
  };

  const updateOption = (id: string, patch: Partial<{ text: string; feedback: string }>) => {
    onChange({
      ...config,
      options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };

  const addOption = () => {
    onChange({
      ...config,
      options: [...options, { id: newOptionId(), text: "", feedback: "" }],
    });
  };

  const removeOption = (id: string) => {
    const nextOptions = options.filter((o) => o.id !== id);
    const nextCorrect = Array.from(correctIds).filter((c) => c !== id);
    onChange({
      ...config,
      options: nextOptions,
      correct_option_ids:
        nextCorrect.length > 0 ? nextCorrect : nextOptions[0] ? [nextOptions[0].id] : [],
    });
  };

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-2">
        Options (check every correct answer — learner must match exactly)
      </p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={correctIds.has(o.id)}
              onChange={() => toggleCorrect(o.id)}
              className="mt-2"
              aria-label="Mark as correct"
            />
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={o.text}
                onChange={(e) => updateOption(o.id, { text: e.target.value })}
                placeholder="Option text"
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={o.feedback ?? ""}
                onChange={(e) => updateOption(o.id, { feedback: e.target.value })}
                placeholder="Feedback shown if picked (optional)"
                className="w-full rounded-md border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600"
              />
            </div>
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(o.id)}
                className="text-xs text-neutral-400 hover:text-brand-pink"
                aria-label="Remove option"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addOption}
        className="mt-2 text-xs text-brand-blue hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}

function TrueFalseEditor({ config, onChange }: EditorProps) {
  const correct = (config.correct as boolean) ?? true;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-600">Correct answer</p>
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={correct === true}
            onChange={() => onChange({ ...config, correct: true })}
          />
          True
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={correct === false}
            onChange={() => onChange({ ...config, correct: false })}
          />
          False
        </label>
      </div>
      <label className="block">
        <span className="block text-[11px] font-medium text-neutral-600 mb-1">
          Feedback if learner picks True
        </span>
        <input
          type="text"
          value={(config.true_feedback as string) ?? ""}
          onChange={(e) => onChange({ ...config, true_feedback: e.target.value })}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] font-medium text-neutral-600 mb-1">
          Feedback if learner picks False
        </span>
        <input
          type="text"
          value={(config.false_feedback as string) ?? ""}
          onChange={(e) => onChange({ ...config, false_feedback: e.target.value })}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>
    </div>
  );
}

function ShortAnswerEditor({ config, onChange }: EditorProps) {
  const answers = (config.acceptable_answers as string[]) ?? [""];
  const caseSensitive = !!config.case_sensitive;

  const updateAt = (i: number, value: string) => {
    const next = answers.slice();
    next[i] = value;
    onChange({ ...config, acceptable_answers: next });
  };

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-2">
        Acceptable answers (learner matches any one)
      </p>
      <ul className="space-y-1.5">
        {answers.map((a, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dynamic list with stable editing UX
          <li key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={a}
              onChange={(e) => updateAt(i, e.target.value)}
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            {answers.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    acceptable_answers: answers.filter((_, j) => j !== i),
                  })
                }
                className="text-xs text-neutral-400 hover:text-brand-pink"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange({ ...config, acceptable_answers: [...answers, ""] })}
        className="mt-2 text-xs text-brand-blue hover:underline"
      >
        + Add acceptable answer
      </button>
      <label className="mt-3 flex items-center gap-2 text-xs text-neutral-700">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => onChange({ ...config, case_sensitive: e.target.checked })}
        />
        Case-sensitive match
      </label>
    </div>
  );
}

function MatchingEditor({ config, onChange }: EditorProps) {
  const pairs = (config.pairs as Array<{ id: string; left: string; right: string }>) ?? [];

  const updatePair = (id: string, patch: Partial<{ left: string; right: string }>) => {
    onChange({
      ...config,
      pairs: pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-2">
        Pairs — learner matches Left → Right
      </p>
      <ul className="space-y-2">
        {pairs.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <input
              type="text"
              value={p.left}
              onChange={(e) => updatePair(p.id, { left: e.target.value })}
              placeholder="Left"
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            <span className="text-neutral-400">→</span>
            <input
              type="text"
              value={p.right}
              onChange={(e) => updatePair(p.id, { right: e.target.value })}
              placeholder="Right"
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            {pairs.length > 2 && (
              <button
                type="button"
                onClick={() => onChange({ ...config, pairs: pairs.filter((pp) => pp.id !== p.id) })}
                className="text-xs text-neutral-400 hover:text-brand-pink"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...config,
            pairs: [...pairs, { id: newOptionId(), left: "", right: "" }],
          })
        }
        className="mt-2 text-xs text-brand-blue hover:underline"
      >
        + Add pair
      </button>
    </div>
  );
}

function OrderingEditor({ config, onChange }: EditorProps) {
  const items = (config.items as Array<{ id: string; text: string }>) ?? [];

  const move = (i: number, direction: "up" | "down") => {
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...config, items: next });
  };

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-2">
        Correct order (learner drags into this sequence)
      </p>
      <ol className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 w-6">{i + 1}.</span>
            <input
              type="text"
              value={it.text}
              onChange={(e) =>
                onChange({
                  ...config,
                  items: items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)),
                })
              }
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => move(i, "up")}
                disabled={i === 0}
                className="text-xs text-neutral-400 hover:text-brand-blue disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, "down")}
                disabled={i === items.length - 1}
                className="text-xs text-neutral-400 hover:text-brand-blue disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            {items.length > 2 && (
              <button
                type="button"
                onClick={() => onChange({ ...config, items: items.filter((x) => x.id !== it.id) })}
                className="text-xs text-neutral-400 hover:text-brand-pink"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange({ ...config, items: [...items, { id: newOptionId(), text: "" }] })}
        className="mt-2 text-xs text-brand-blue hover:underline"
      >
        + Add item
      </button>
    </div>
  );
}
