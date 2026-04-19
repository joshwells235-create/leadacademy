"use client";

import Link from "next/link";
import type { ToolRendererProps } from "./types";

type LessonHit = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  href: string;
};

type SuggestLessonOutput = { lessons?: LessonHit[] } | { error?: string } | null;

export function SuggestLessonRenderer({ part }: ToolRendererProps) {
  const output = (part.output ?? null) as SuggestLessonOutput;

  if (part.state !== "output-available" || !output) {
    return <p className="mt-1 text-xs italic text-neutral-500">searching lessons…</p>;
  }

  if ("error" in output && output.error) {
    return (
      <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
        Couldn't search lessons: {output.error}
      </p>
    );
  }

  const lessons = "lessons" in output ? (output.lessons ?? []) : [];
  if (lessons.length === 0) {
    return null; // coach will acknowledge in text; no card needed
  }

  return (
    <div className="mt-2 space-y-1.5">
      {lessons.map((l) => (
        <Link
          key={l.lessonId}
          href={l.href}
          className="block rounded-lg border border-brand-blue/30 bg-white p-3 transition hover:border-brand-blue hover:bg-brand-blue/5"
        >
          <p className="text-xs uppercase tracking-wide text-brand-blue">Lesson</p>
          <p className="mt-0.5 font-medium text-brand-navy">{l.lessonTitle}</p>
          <p className="text-xs text-neutral-500">
            {l.courseTitle} · {l.moduleTitle}
          </p>
        </Link>
      ))}
    </div>
  );
}
