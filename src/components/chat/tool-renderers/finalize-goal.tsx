"use client";

import { ApprovalPill } from "./approval-pill";
import { getApprovalId, type ToolRendererProps } from "./types";

type FinalizeInput = {
  title?: string;
  impact_self?: string;
  impact_others?: string;
  impact_org?: string;
  target_date?: string;
};

type FinalizeOutput = {
  id?: string;
  title?: string;
  error?: string;
};

export function FinalizeGoalRenderer({ part, isLatestMessage, onApproval }: ToolRendererProps) {
  const input = (part.input ?? {}) as FinalizeInput;
  const output = (part.output ?? null) as FinalizeOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't save goal: {output.error}
        </p>
      );
    }
    return (
      <p className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
        ✓ Saved goal: <strong>{output.title}</strong>
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
        title="Save this goal?"
        applyLabel="Save goal"
        approvalId={getApprovalId(part)}
        isLatestMessage={isLatestMessage}
        onApproval={onApproval}
        body={
          <div className="space-y-1">
            {input.title ? <p className="font-medium">{input.title}</p> : null}
            {input.impact_self ? (
              <p className="text-xs">
                <span className="font-semibold text-neutral-600">You:</span> {input.impact_self}
              </p>
            ) : null}
            {input.impact_others ? (
              <p className="text-xs">
                <span className="font-semibold text-neutral-600">Others:</span>{" "}
                {input.impact_others}
              </p>
            ) : null}
            {input.impact_org ? (
              <p className="text-xs">
                <span className="font-semibold text-neutral-600">Org:</span> {input.impact_org}
              </p>
            ) : null}
            {input.target_date ? (
              <p className="text-xs text-neutral-500">Target: {input.target_date}</p>
            ) : null}
          </div>
        }
      />
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">drafting goal…</p>;
}
