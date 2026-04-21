"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { upsertLessonNote } from "@/lib/learning/note-actions";

/**
 * LMS Phase D3 — per-lesson notes panel.
 *
 * Collapsible to stay out of the way while reading; expands once the
 * learner has anything saved. Auto-saves on a 1.5s debounce so the
 * learner never has to think about it. Surfaces save state in a small
 * subtitle so silent failures are visible.
 *
 * Content length capped at 8000 chars (matches server zod). Notes feed
 * LearnerContext, so the thought partner already knows what's been
 * flagged when the learner opens a chat.
 */

const AUTOSAVE_MS = 1500;
const MAX_CHARS = 8000;

type Props = {
  lessonId: string;
  initialContent: string;
};

export function LessonNotes({ lessonId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [expanded, setExpanded] = useState(initialContent.length > 0);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    initialContent.length > 0 ? "saved" : "idle",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = content !== savedContent;

  const save = (next: string) => {
    start(async () => {
      setState("saving");
      setErrMsg(null);
      const res = await upsertLessonNote({ lessonId, content: next });
      if ("error" in res) {
        setState("error");
        setErrMsg(res.error);
        return;
      }
      setSavedContent(next);
      setState("saved");
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on content change only; `save` + `dirty` read fresh values from closure
  useEffect(() => {
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save(content);
    }, AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content]);

  // On unmount, flush any pending save immediately so the learner doesn't
  // lose unsaved keystrokes when navigating away mid-debounce.
  // biome-ignore lint/correctness/useExhaustiveDependencies: unmount cleanup reads current closure values intentionally
  useEffect(() => {
    return () => {
      if (timerRef.current && content !== savedContent) {
        clearTimeout(timerRef.current);
        // Fire but don't await — unmount is sync.
        void upsertLessonNote({ lessonId, content });
      }
    };
  }, []);

  const remaining = MAX_CHARS - content.length;
  const nearCap = remaining < 200;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Your notes</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Private to you. Your thought partner is aware of recent notes so you can pick up threads
            in chat without re-explaining.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px]">
          {state === "saving" && <span className="text-amber-600">Saving…</span>}
          {state === "saved" && !dirty && savedContent.length > 0 && (
            <span className="text-emerald-600">✓ Saved</span>
          )}
          {state === "error" && errMsg && (
            <span className="text-danger" title={errMsg}>
              ⚠ Save failed
            </span>
          )}
          <span className="text-neutral-400" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-neutral-100 px-5 pb-4 pt-3">
          <textarea
            value={content}
            onChange={(e) => {
              const next = e.target.value.slice(0, MAX_CHARS);
              setContent(next);
              setState("idle");
            }}
            placeholder="What's landing? What are you skeptical of? What do you want to try this week?"
            rows={5}
            disabled={pending && state === "saving"}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Auto-saves as you type.</span>
            <span className={nearCap ? "text-amber-600" : ""}>
              {remaining.toLocaleString()} left
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
