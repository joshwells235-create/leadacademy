/**
 * LMS Phase C3 — pure helper for "is this assignment due / overdue?"
 *
 * `due_at` lives on `cohort_courses` (per-cohort assignment of a course)
 * as a `date`. Soft date by design — we display, surface in vitality, but
 * never block submission. Per CLAUDE.md C3 decision: hard locks frustrate
 * learners; admins want the data, not enforcement.
 *
 * Kept pure (no DB calls) so the same helper can power learner cards,
 * coach dashboards, and admin/consultant vitality without re-fetching.
 */

export type DueStatus =
  | { status: "none" }
  | { status: "on_track"; daysRemaining: number; dueAt: string }
  | { status: "due_soon"; daysRemaining: number; dueAt: string }
  | { status: "overdue"; daysOverdue: number; dueAt: string }
  | { status: "complete"; dueAt: string };

const SOON_THRESHOLD_DAYS = 7;

/**
 * Compute due status for a single (course, learner) pair.
 *
 * @param dueAt   The assignment's due date (`YYYY-MM-DD`) or null.
 * @param isComplete  Whether the learner has completed every lesson.
 * @param now     Reference "today" — defaults to actual today. Tests pass
 *                a fixed date.
 */
export function computeDueStatus(
  dueAt: string | null | undefined,
  isComplete: boolean,
  now: Date = new Date(),
): DueStatus {
  if (!dueAt) return { status: "none" };
  if (isComplete) return { status: "complete", dueAt };

  // Compare as date-only to avoid TZ rounding bugs. Truncate `now` to
  // midnight UTC to match the date column's semantics.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(`${dueAt}T00:00:00Z`);
  const ms = due.getTime() - today.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));

  if (days < 0) return { status: "overdue", daysOverdue: -days, dueAt };
  if (days <= SOON_THRESHOLD_DAYS) return { status: "due_soon", daysRemaining: days, dueAt };
  return { status: "on_track", daysRemaining: days, dueAt };
}

/** UI-friendly short label, e.g. "Due in 3d", "Overdue 2d", "Done". */
export function dueStatusLabel(s: DueStatus): string {
  switch (s.status) {
    case "none":
      return "";
    case "on_track":
      return `Due in ${s.daysRemaining}d`;
    case "due_soon":
      return s.daysRemaining === 0 ? "Due today" : `Due in ${s.daysRemaining}d`;
    case "overdue":
      return s.daysOverdue === 1 ? "Overdue 1d" : `Overdue ${s.daysOverdue}d`;
    case "complete":
      return "Done";
  }
}

/** Tailwind class for the chip color, matching the brand palette. */
export function dueStatusChipClass(s: DueStatus): string {
  switch (s.status) {
    case "overdue":
      return "bg-brand-pink/10 text-brand-pink";
    case "due_soon":
      return "bg-amber-100 text-amber-800";
    case "on_track":
      return "bg-brand-blue/10 text-brand-blue";
    case "complete":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "";
  }
}
