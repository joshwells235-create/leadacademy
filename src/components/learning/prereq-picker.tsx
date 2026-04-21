"use client";

import { useState, useTransition } from "react";
import { setCoursePrerequisites, setLessonPrerequisites } from "@/lib/learning/prereq-actions";

/**
 * Author UI for lesson + course prereqs. Multi-checkbox form with optimistic
 * "selected" state and server-action save. The same component handles both
 * flavors via the `kind` prop — the action signatures are the same shape and
 * the UI is identical apart from the noun.
 */

export type PrereqOption = {
  id: string;
  title: string;
  /** Optional sublabel — e.g. module title for lessons, or status for courses. */
  sublabel?: string | null;
};

type Props = {
  kind: "lesson" | "course";
  /** Id of the lesson/course whose prereqs we're editing. */
  targetId: string;
  /** Currently-saved prereq target ids. */
  initialSelected: string[];
  /** All eligible options (already excluding the target itself). */
  options: PrereqOption[];
};

export function PrereqPicker({ kind, targetId, initialSelected, options }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const noun = kind === "lesson" ? "lesson" : "course";
  const Noun = kind === "lesson" ? "Lessons" : "Courses";

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setState("idle");
  };

  const save = () => {
    setErrMsg(null);
    start(async () => {
      const ids = Array.from(selected);
      const res =
        kind === "lesson"
          ? await setLessonPrerequisites({ lessonId: targetId, requiredLessonIds: ids })
          : await setCoursePrerequisites({ courseId: targetId, requiredCourseIds: ids });
      if ("error" in res) {
        setState("error");
        setErrMsg(res.error);
        return;
      }
      setState("saved");
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Prerequisites</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {kind === "lesson"
              ? "Lessons a learner must complete before opening this one. Locked lessons stay visible with a lock icon."
              : "Courses a learner must finish before this one becomes available."}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-neutral-400">{selected.size} selected</span>
      </div>

      {options.length === 0 ? (
        <p className="mt-4 text-xs italic text-neutral-500">
          No other {noun}s are available to require.
        </p>
      ) : (
        <ul className="mt-3 max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded border border-neutral-100">
          {options.map((opt) => {
            const checked = selected.has(opt.id);
            return (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-brand-light">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.id)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-brand-navy">{opt.title}</span>
                    {opt.sublabel && (
                      <span className="block truncate text-[11px] text-neutral-500">
                        {opt.sublabel}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs">
          {state === "saved" && <span className="text-emerald-600">Saved.</span>}
          {state === "error" && (
            <span className="text-danger">{errMsg ?? "Couldn't save."}</span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : `Save ${Noun.toLowerCase()} prereqs`}
        </button>
      </div>
    </div>
  );
}
