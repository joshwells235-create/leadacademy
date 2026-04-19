"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Sibling = { id: string; name: string };

/**
 * Prev/next within a cohort's roster. Mirrors the coach-side
 * LearnerNav — keyboard ←/→ shortcuts, disabled when the user is
 * typing in a form (wouldn't matter much on consultant learner detail
 * since there are no input fields, but keeps behavior consistent).
 */
export function ConsultantLearnerNav({
  prev,
  next,
  position,
  total,
  cohortId,
}: {
  prev: Sibling | null;
  next: Sibling | null;
  position: number;
  total: number;
  cohortId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        router.push(`/consultant/learners/${prev.id}`);
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        router.push(`/consultant/learners/${next.id}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, router]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
      {prev ? (
        <Link
          href={`/consultant/learners/${prev.id}`}
          className="inline-flex items-center gap-1 text-brand-blue hover:underline"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">{prev.name}</span>
          <span className="sm:hidden">Prev</span>
        </Link>
      ) : (
        <span className="text-neutral-400">No previous</span>
      )}
      <span className="text-neutral-500">
        Learner {position} of {total}
        {cohortId && (
          <Link
            href={`/consultant/cohorts/${cohortId}`}
            className="ml-2 text-brand-blue hover:underline"
          >
            Cohort roster
          </Link>
        )}
        <span className="ml-2 hidden text-neutral-400 lg:inline">
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1">←</kbd>{" "}
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1">→</kbd>
        </span>
      </span>
      {next ? (
        <Link
          href={`/consultant/learners/${next.id}`}
          className="inline-flex items-center gap-1 text-brand-blue hover:underline"
        >
          <span className="hidden sm:inline">{next.name}</span>
          <span className="sm:hidden">Next</span>
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <span className="text-neutral-400">No next</span>
      )}
    </div>
  );
}
