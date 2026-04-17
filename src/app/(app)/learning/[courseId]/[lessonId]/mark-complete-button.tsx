"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/lib/learning/actions";

export function MarkCompleteButton({
  lessonId,
  completed,
  nextLessonUrl,
  courseUrl,
}: {
  lessonId: string;
  completed: boolean;
  nextLessonUrl?: string;
  courseUrl: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (completed) {
    return <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-900">✓ Completed</span>;
  }

  return (
    <button
      onClick={() => start(async () => {
        await markLessonComplete(lessonId);
        // Auto-advance: brief pause then navigate.
        if (nextLessonUrl) {
          router.push(nextLessonUrl);
        } else {
          router.push(courseUrl);
        }
      })}
      disabled={pending}
      className="rounded-md bg-brand-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60 transition"
    >
      {pending ? "Saving..." : nextLessonUrl ? "Complete & continue →" : "Complete lesson ✓"}
    </button>
  );
}
