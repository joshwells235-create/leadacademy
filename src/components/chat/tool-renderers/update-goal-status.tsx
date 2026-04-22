"use client";

import { ApprovalPill } from "./approval-pill";
import { getApprovalId, type ToolRendererProps } from "./types";

type UpdateGoalStatusInput = {
  goal_id?: string;
  status?: "completed" | "archived" | "in_progress";
  rationale?: string;
};

type UpdateGoalStatusOutput = {
  id?: string;
  title?: string;
  status?: string;
  error?: string;
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Complete",
  archived: "Archive",
  in_progress: "Reopen",
};

export function UpdateGoalStatusRenderer({ part, isLatestMessage, onApproval }: ToolRendererProps) {
  const input = (part.input ?? {}) as UpdateGoalStatusInput;
  const output = (part.output ?? null) as UpdateGoalStatusOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't update goal: {output.error}
        </p>
      );
    }
    return (
      <p className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
        ✓ Updated goal: <strong>{output.title}</strong> → {output.status}
      </p>
    );
  }

  if (
    part.state === "approval-requested" ||
    part.state === "approval-responded" ||
    part.state === "input-available"
  ) {
    return (
      <ApprovalPill
        title={input.status ? (STATUS_LABEL[input.status] ?? "Update goal") : "Update goal"}
        applyLabel={input.status ? (STATUS_LABEL[input.status] ?? "Apply") : "Apply"}
        approvalId={getApprovalId(part)}
        isLatestMessage={isLatestMessage}
        onApproval={onApproval}
        body={
          <p className="text-xs">
            {input.rationale ?? "Your thought partner proposes updating this goal's status."}
          </p>
        }
      />
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">preparing update…</p>;
}
