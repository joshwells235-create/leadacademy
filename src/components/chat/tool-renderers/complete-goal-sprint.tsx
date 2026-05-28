"use client";

import { ApprovalPill } from "./approval-pill";
import { getApprovalId, type ToolRendererProps } from "./types";

type CompleteSprintInput = {
  sprint_id?: string;
  outcome?: "completed" | "abandoned";
  reflection?: string;
};

type CompleteSprintOutput = {
  id?: string;
  title?: string;
  outcome?: "completed" | "abandoned";
  action_count?: number;
  error?: string;
};

export function CompleteGoalSprintRenderer({
  part,
  isLatestMessage,
  onApproval,
}: ToolRendererProps) {
  const input = (part.input ?? {}) as CompleteSprintInput;
  const output = (part.output ?? null) as CompleteSprintOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't close sprint: {output.error}
        </p>
      );
    }
    const closed = output.outcome === "abandoned" ? "set aside" : "wrapped";
    return (
      <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <p>
          ✓ Sprint {closed}: <strong>{output.title}</strong>
        </p>
        {typeof output.action_count === "number" && (
          <p className="mt-0.5 text-xs text-emerald-800">
            {output.action_count} moment{output.action_count === 1 ? "" : "s"} logged across the
            sprint.
          </p>
        )}
      </div>
    );
  }

  if (
    part.state === "approval-requested" ||
    part.state === "approval-responded" ||
    part.state === "input-available"
  ) {
    const isAbandon = input.outcome === "abandoned";
    return (
      <ApprovalPill
        title={isAbandon ? "Set this sprint aside?" : "Wrap up this sprint?"}
        applyLabel={isAbandon ? "Set it aside" : "Wrap it up"}
        approvalId={getApprovalId(part)}
        isLatestMessage={isLatestMessage}
        onApproval={onApproval}
        body={
          <div className="space-y-1">
            <p className="text-xs text-neutral-600">
              {isAbandon
                ? "Closes the sprint without marking it as a win. No new sprint starts — you can begin a fresh one whenever you're ready."
                : "Closes the sprint out. No new sprint starts — you can begin the next one whenever you're ready."}
            </p>
            {input.reflection && (
              <p className="text-xs italic text-neutral-700">"{input.reflection}"</p>
            )}
          </div>
        }
      />
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">closing sprint…</p>;
}
