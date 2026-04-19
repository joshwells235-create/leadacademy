"use client";

import { useState } from "react";

/**
 * Super-admin conversation message body. Handles three shapes of
 * `ai_messages.content`:
 *   1. Plain string (simple assistant / user text)
 *   2. AI SDK array of parts: [{ type: "text", text }, { type: "tool-..." }, ...]
 *   3. Opaque JSON — pretty-printed fallback
 *
 * Long bodies collapse to ~20 lines with a "Show full message" toggle.
 */
export function MessageBody({ content }: { content: unknown }) {
  const [expanded, setExpanded] = useState(false);

  const { text, parts } = normalize(content);
  const lineCount = text.split("\n").length;
  const isLong = text.length > 1200 || lineCount > 20;

  return (
    <div className="text-sm text-neutral-800">
      {parts ? (
        <div className="space-y-2">
          {parts.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: message parts are stable in render order
            <PartView key={i} part={p} />
          ))}
        </div>
      ) : (
        <pre
          className={`whitespace-pre-wrap font-sans ${isLong && !expanded ? "max-h-64 overflow-hidden" : ""}`}
        >
          {text}
        </pre>
      )}
      {isLong && !parts && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-brand-blue hover:underline"
        >
          {expanded ? "Collapse" : `Show full message (${lineCount} lines)`}
        </button>
      )}
    </div>
  );
}

type Part = {
  type: string;
  text?: string;
  json?: unknown;
};

function normalize(content: unknown): { text: string; parts: Part[] | null } {
  if (typeof content === "string") return { text: content, parts: null };
  if (Array.isArray(content)) {
    const parts: Part[] = content.map((p) => {
      if (!p || typeof p !== "object") return { type: "unknown", json: p };
      const rec = p as Record<string, unknown>;
      const type = typeof rec.type === "string" ? rec.type : "unknown";
      if (type === "text") {
        return { type: "text", text: typeof rec.text === "string" ? rec.text : "" };
      }
      return { type, json: rec };
    });
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("\n\n");
    return { text, parts };
  }
  if (content && typeof content === "object") {
    try {
      return { text: JSON.stringify(content, null, 2), parts: null };
    } catch {
      return { text: "[unserializable]", parts: null };
    }
  }
  return { text: "", parts: null };
}

function PartView({ part }: { part: Part }) {
  if (part.type === "text") {
    return <pre className="whitespace-pre-wrap font-sans">{part.text}</pre>;
  }
  return (
    <details className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs">
      <summary className="cursor-pointer font-mono text-neutral-600">{part.type}</summary>
      <pre className="mt-1 overflow-auto text-[11px] text-neutral-700">
        {JSON.stringify(part.json, null, 2)}
      </pre>
    </details>
  );
}
