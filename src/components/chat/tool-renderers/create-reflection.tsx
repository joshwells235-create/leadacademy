"use client";

import Link from "next/link";
import type { ToolRendererProps } from "./types";

type CreateReflectionInput = {
  content?: string;
  themes?: string[];
};

type CreateReflectionOutput = { id?: string; error?: string };

export function CreateReflectionRenderer({ part }: ToolRendererProps) {
  const input = (part.input ?? {}) as CreateReflectionInput;
  const output = (part.output ?? null) as CreateReflectionOutput | null;

  if (part.state === "output-available" && output) {
    if (output.error) {
      return (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
          Couldn't save reflection: {output.error}
        </p>
      );
    }
    return (
      <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
        ✓ Saved reflection
        {input.themes?.length ? (
          <span className="ml-1 text-xs text-emerald-800">[{input.themes.join(", ")}]</span>
        ) : null}
        {" · "}
        <Link href="/reflections" className="text-brand-blue hover:underline">
          View reflections
        </Link>
      </div>
    );
  }

  return <p className="mt-1 text-xs italic text-neutral-500">saving reflection…</p>;
}
