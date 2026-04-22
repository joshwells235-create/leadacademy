"use client";

import { ApprovalPill } from "./approval-pill";
import { getApprovalId, type ToolRendererProps } from "./types";

type SectionKind = "before" | "catalyst" | "shift" | "evidence" | "what_next";

const SECTION_LABEL: Record<SectionKind, string> = {
  before: "Before",
  catalyst: "Catalyst",
  shift: "Shift",
  evidence: "Evidence",
  what_next: "What's Next",
};

type Moment = { title?: string; description?: string };
type Quote = { text?: string; source?: string };

type RefineInput = {
  kind?: SectionKind;
  heading?: string;
  body?: string;
  moments?: Moment[];
  pull_quotes?: Quote[];
};

type RefineOutput = {
  ok?: boolean;
  kind?: SectionKind;
  heading?: string;
  error?: string;
};

export function RefineCapstoneSectionRenderer({
  part,
  isLatestMessage,
  onApproval,
}: ToolRendererProps) {
  const input = (part.input ?? {}) as RefineInput;
  const output = (part.output ?? null) as RefineOutput | null;
  const label = input.kind ? SECTION_LABEL[input.kind] : "Section";

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't save section: {output.error}
        </p>
      );
    }
    return (
      <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <p>
          ✓ Saved <strong>{output.kind ? SECTION_LABEL[output.kind] : label}</strong>
          {output.heading ? `: ${output.heading}` : ""}
        </p>
      </div>
    );
  }

  if (
    part.state === "approval-requested" ||
    part.state === "approval-responded" ||
    part.state === "input-available"
  ) {
    return (
      <ApprovalPill
        title={`Update ${label} section?`}
        applyLabel="Save section"
        approvalId={getApprovalId(part)}
        isLatestMessage={isLatestMessage}
        onApproval={onApproval}
        body={
          <div className="space-y-2">
            {input.heading && <p className="font-medium">{input.heading}</p>}
            {input.body && (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
                {input.body}
              </p>
            )}
            {input.moments && input.moments.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Moments
                </p>
                <ul className="mt-0.5 space-y-0.5 text-xs text-neutral-700">
                  {input.moments.map((m) => (
                    <li key={`${m.title ?? ""}-${(m.description ?? "").slice(0, 24)}`}>
                      {m.title && <span className="font-medium">{m.title}: </span>}
                      {m.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {input.pull_quotes && input.pull_quotes.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Pull quotes
                </p>
                <ul className="mt-0.5 space-y-0.5 text-xs italic text-neutral-700">
                  {input.pull_quotes.map((q) => (
                    <li key={`${q.source ?? ""}-${(q.text ?? "").slice(0, 24)}`}>
                      "{q.text}"
                      {q.source && (
                        <span className="not-italic text-neutral-500"> — {q.source}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">drafting section…</p>;
}
