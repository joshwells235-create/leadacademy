"use client";

import { useState, useTransition } from "react";
import { saveCoachNote } from "@/lib/coach/actions";

export function CoachNoteEditor({
  learnerId,
  initialContent,
}: {
  learnerId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleSave = () => {
    if (content === initialContent && saveState !== "error") return;
    setError(null);
    start(async () => {
      const res = await saveCoachNote(learnerId, content);
      if ("error" in res && res.error) {
        setSaveState("error");
        setError(res.error);
        return;
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    });
  };

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (saveState !== "idle") setSaveState("idle");
        }}
        onBlur={handleSave}
        rows={6}
        placeholder="Private to you. Patterns you're noticing, things to revisit, half-formed hypotheses — whatever helps you show up sharp in your next session with this learner."
        aria-label="Your private coach notes about this learner"
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
      <div className="mt-1 flex items-center gap-2 text-xs">
        {pending && <span className="text-neutral-500">Saving…</span>}
        {saveState === "saved" && <span className="text-emerald-700">Saved</span>}
        {saveState === "error" && (
          <span className="text-red-700">
            Couldn't save{error ? `: ${error}` : ""}. Try again in a moment.
          </span>
        )}
        {saveState === "idle" && !pending && (
          <span className="text-neutral-400">Saves automatically when you click away.</span>
        )}
      </div>
    </div>
  );
}
