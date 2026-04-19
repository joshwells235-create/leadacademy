"use client";

import Link from "next/link";
import type { ToolRendererProps } from "./types";

type LogActionInput = {
  description?: string;
  impact_area?: string;
};

type LogActionOutput = { id?: string; error?: string };

export function LogActionRenderer({ part }: ToolRendererProps) {
  const input = (part.input ?? {}) as LogActionInput;
  const output = (part.output ?? null) as LogActionOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't log that action: {output.error}
        </p>
      );
    }
    return (
      <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
        ✓ Logged:{" "}
        <span className="font-medium">
          {input.description ? truncate(input.description, 160) : "action"}
        </span>
        {" · "}
        <Link href="/action-log" className="text-brand-blue hover:underline">
          Edit in action log
        </Link>
      </div>
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">logging action…</p>;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
