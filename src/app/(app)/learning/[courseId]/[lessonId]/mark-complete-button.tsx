"use client";

import { useTransition } from "react";
import { markLessonComplete } from "@/lib/learning/actions";

export function MarkCompleteButton({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const [pending, start] = useTransition();

  if (completed) {
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-900">Completed</span>;
  }

  return (
    <button
      onClick={() => start(async () => { await markLessonComplete(lessonId); })}
      disabled={pending}
      className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
    >
      {pending ? "Saving..." : "Mark as complete"}
    </button>
  );
}
