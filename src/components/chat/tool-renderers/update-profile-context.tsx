"use client";

import type { ToolRendererProps } from "./types";

type UpdateInput = {
  role_title?: string;
  function_area?: string;
  team_size?: number;
  total_org_influence?: number;
  tenure_at_org?: string;
  tenure_in_leadership?: string;
  company_size?: string;
  industry?: string;
  context_notes?: string;
  mark_complete?: boolean;
};

type UpdateOutput = {
  ok?: boolean;
  updated_fields?: string[];
  marked_complete?: boolean;
  error?: string;
};

const FIELD_LABEL: Record<string, string> = {
  role_title: "Role",
  function_area: "Function",
  team_size: "Team size",
  total_org_influence: "Total org",
  tenure_at_org: "Tenure at org",
  tenure_in_leadership: "Leadership tenure",
  company_size: "Company size",
  industry: "Industry",
  context_notes: "Context",
};

export function UpdateProfileContextRenderer({ part }: ToolRendererProps) {
  const input = (part.input ?? {}) as UpdateInput;
  const output = (part.output ?? null) as UpdateOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Couldn't save that to your profile: {output.error}
        </p>
      );
    }

    const fields = (output.updated_fields ?? []).filter((f) => f !== "mark_complete");
    const fieldSummary = fields.length > 0 ? summarizeFields(fields, input) : null;

    if (output.marked_complete) {
      return (
        <div className="mt-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white"
            >
              ✓
            </span>
            <span>Intake complete</span>
          </div>
          {fieldSummary && <p className="mt-1.5 text-xs text-emerald-800">Saved: {fieldSummary}</p>}
          <p className="mt-1.5 text-xs text-emerald-800">
            From here on, your thought partner picks up the rest — ask about anything you're working
            on.
          </p>
        </div>
      );
    }

    return (
      <div
        className="mt-2 rounded-md border border-brand-blue/20 bg-brand-blue/5 px-3 py-2 text-xs text-brand-navy"
        aria-live="polite"
      >
        <span className="font-semibold">✓ Saved to your profile:</span>{" "}
        {fieldSummary ?? <span className="text-neutral-600">intake noted</span>}
      </div>
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">saving to your profile…</p>;
}

function summarizeFields(fields: string[], input: UpdateInput): string {
  return fields
    .map((f) => {
      const label = FIELD_LABEL[f] ?? f;
      const value = (input as Record<string, unknown>)[f];
      if (value === undefined || value === null || value === "") return label;
      const display =
        typeof value === "string" && value.length > 60 ? `${value.slice(0, 60)}…` : value;
      return `${label}: ${display}`;
    })
    .join(" · ");
}
