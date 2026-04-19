"use client";

import { ApprovalPill } from "./approval-pill";
import type { ToolRendererProps } from "./types";

type SetChallengeInput = {
  challenge?: string;
  for_date?: "today" | "tomorrow";
  replace_existing?: boolean;
};

type SetChallengeOutput =
  | { id?: string; challenge?: string; for_date?: string; replaced?: boolean }
  | { collision?: true; existing_challenge?: string; for_date?: string }
  | { error?: string }
  | null;

export function SetDailyChallengeRenderer({
  part,
  isLatestMessage,
  onApproval,
}: ToolRendererProps) {
  const input = (part.input ?? {}) as SetChallengeInput;
  const output = (part.output ?? null) as SetChallengeOutput;

  if (part.state === "output-available" && output) {
    if ("error" in output && output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't set challenge: {output.error}
        </p>
      );
    }
    if ("collision" in output && output.collision) {
      // Coach will handle in follow-up text; don't show a confusing card.
      return null;
    }
    if ("id" in output && output.id) {
      return (
        <p className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
          ✓ {output.replaced ? "Replaced" : "Set"} challenge for {output.for_date ?? "today"}:{" "}
          <strong>{output.challenge}</strong>
        </p>
      );
    }
    return null;
  }

  if (part.state === "approval-requested" || part.state === "input-available") {
    return (
      <ApprovalPill
        title={`Set ${input.for_date ?? "tomorrow"}'s challenge?`}
        applyLabel="Set challenge"
        approvalId={part.approvalId}
        isLatestMessage={isLatestMessage}
        onApproval={onApproval}
        body={<p className="text-sm">{input.challenge ?? "(drafting challenge)"}</p>}
      />
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">preparing challenge…</p>;
}
