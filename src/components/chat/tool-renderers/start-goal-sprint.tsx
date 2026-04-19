"use client";

import { ApprovalPill } from "./approval-pill";
import type { ToolRendererProps } from "./types";

type StartSprintInput = {
  goal_id?: string;
  title?: string;
  practice?: string;
  planned_end_date?: string;
};

type StartSprintOutput = {
  id?: string;
  title?: string;
  practice?: string;
  planned_end_date?: string;
  sprint_number?: number;
  error?: string;
};

export function StartGoalSprintRenderer({ part, isLatestMessage, onApproval }: ToolRendererProps) {
  const input = (part.input ?? {}) as StartSprintInput;
  const output = (part.output ?? null) as StartSprintOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't start sprint: {output.error}
        </p>
      );
    }
    return (
      <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <p>
          ✓ Sprint {output.sprint_number} started: <strong>{output.title}</strong>
        </p>
        {output.practice && <p className="mt-1 text-xs">Practicing: {output.practice}</p>}
        {output.planned_end_date && (
          <p className="mt-0.5 text-xs text-emerald-800">Through {output.planned_end_date}</p>
        )}
      </div>
    );
  }

  if (part.state === "approval-requested" || part.state === "input-available") {
    return (
      <ApprovalPill
        title="Start this sprint?"
        applyLabel="Start sprint"
        approvalId={part.approvalId}
        isLatestMessage={isLatestMessage}
        onApproval={onApproval}
        body={
          <div className="space-y-1">
            {input.title && <p className="font-medium">{input.title}</p>}
            {input.practice && (
              <p className="text-xs">
                <span className="font-semibold text-neutral-600">Practicing:</span> {input.practice}
              </p>
            )}
            {input.planned_end_date && (
              <p className="text-xs text-neutral-500">Through {input.planned_end_date}</p>
            )}
          </div>
        }
      />
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">drafting sprint…</p>;
}
