"use client";

import { useTransition } from "react";
import { updateGoalStatus } from "@/lib/goals/actions";

const OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function GoalStatusForm({ goalId, status }: { goalId: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          await updateGoalStatus(goalId, next);
        });
      }}
      disabled={pending}
      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
