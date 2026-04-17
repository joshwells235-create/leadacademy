"use client";

import { useState, useTransition } from "react";
import { saveCoachNote } from "@/lib/coach/actions";

export function CoachNoteEditor({ learnerId, initialContent }: { learnerId: string; initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const handleSave = () => {
    start(async () => {
      await saveCoachNote(learnerId, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        onBlur={handleSave}
        rows={6}
        placeholder="Your private notes about this learner..."
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
        {pending && <span>Saving...</span>}
        {saved && <span className="text-emerald-600">Saved</span>}
        <span>Auto-saves on blur</span>
      </div>
    </div>
  );
}
