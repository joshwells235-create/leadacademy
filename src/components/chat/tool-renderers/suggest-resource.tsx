"use client";

import type { ToolRendererProps } from "./types";

type ResourceHit = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: string;
  url: string;
};

type SuggestResourceOutput = { resources?: ResourceHit[] } | { error?: string } | null;

export function SuggestResourceRenderer({ part }: ToolRendererProps) {
  const output = (part.output ?? null) as SuggestResourceOutput;

  if (part.state !== "output-available" || !output) {
    return <p className="mt-1 text-xs italic text-neutral-500">searching resources…</p>;
  }

  if ("error" in output && output.error) {
    return (
      <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
        Couldn't search resources: {output.error}
      </p>
    );
  }

  const resources = "resources" in output ? (output.resources ?? []) : [];
  if (resources.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {resources.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-brand-blue/30 bg-white p-3 transition hover:border-brand-blue hover:bg-brand-blue/5"
        >
          <p className="text-xs uppercase tracking-wide text-brand-blue">
            {r.type}
            {r.category ? ` · ${r.category}` : ""}
          </p>
          <p className="mt-0.5 font-medium text-brand-navy">{r.title}</p>
          {r.description ? (
            <p className="mt-0.5 text-xs text-neutral-600">{r.description}</p>
          ) : null}
        </a>
      ))}
    </div>
  );
}
