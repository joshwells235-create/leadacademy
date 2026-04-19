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
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't update profile: {output.error}
        </p>
      );
    }

    const fields = (output.updated_fields ?? []).filter((f) => f !== "mark_complete");

    if (output.marked_complete && fields.length === 0) {
      return (
        <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          ✓ Intake complete — your thought partner has what it needs to get started.
        </div>
      );
    }

    return (
      <div className="mt-1 rounded border border-brand-blue/20 bg-brand-blue/5 px-3 py-2 text-xs text-brand-navy">
        <span className="font-medium">✓ Saved to your profile:</span>{" "}
        {fields.length === 0 ? (
          <span className="text-neutral-600">intake noted</span>
        ) : (
          fields
            .map((f) => {
              const label = FIELD_LABEL[f] ?? f;
              const value = (input as Record<string, unknown>)[f];
              if (value === undefined || value === null || value === "") return label;
              const display =
                typeof value === "string" && value.length > 60 ? `${value.slice(0, 60)}…` : value;
              return `${label}: ${display}`;
            })
            .join(" · ")
        )}
        {output.marked_complete && (
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            intake complete
          </span>
        )}
      </div>
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">saving profile…</p>;
}
