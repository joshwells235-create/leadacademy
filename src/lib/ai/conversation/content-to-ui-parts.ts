import type { ContentPart, ToolSet } from "ai";

type ToolPart = {
  type: string;
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "output-available"
    | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approvalId?: string;
};

type UIPart = { type: "text"; text: string } | { type: "reasoning"; text: string } | ToolPart;

/**
 * Convert the server-side ContentPart[] produced by streamText into the
 * UIMessage `parts` shape the `useChat` client expects on replay. Tool calls
 * and their results are merged into a single `tool-<name>` part keyed by
 * toolCallId.
 */
export function contentToUIParts(content: Array<ContentPart<ToolSet>>): UIPart[] {
  const parts: UIPart[] = [];
  const toolPartById = new Map<string, ToolPart>();

  for (const c of content) {
    if (c.type === "text") {
      parts.push({ type: "text", text: c.text });
      continue;
    }
    if (c.type === "reasoning") {
      parts.push({ type: "reasoning", text: c.text });
      continue;
    }
    if (c.type === "tool-call") {
      const part: ToolPart = {
        type: `tool-${c.toolName}`,
        toolCallId: c.toolCallId,
        state: "input-available",
        input: c.input,
      };
      toolPartById.set(c.toolCallId, part);
      parts.push(part);
      continue;
    }
    if (c.type === "tool-result") {
      const existing = toolPartById.get(c.toolCallId);
      if (existing) {
        existing.state = "output-available";
        existing.output = c.output;
      } else {
        parts.push({
          type: `tool-${c.toolName}`,
          toolCallId: c.toolCallId,
          state: "output-available",
          output: c.output,
        });
      }
      continue;
    }
    if (c.type === "tool-approval-request") {
      const existing = toolPartById.get(c.toolCall.toolCallId);
      if (existing) {
        existing.state = "approval-requested";
        existing.approvalId = c.approvalId;
      } else {
        const part: ToolPart = {
          type: `tool-${c.toolCall.toolName}`,
          toolCallId: c.toolCall.toolCallId,
          state: "approval-requested",
          input: c.toolCall.input,
          approvalId: c.approvalId,
        };
        toolPartById.set(c.toolCall.toolCallId, part);
        parts.push(part);
      }
      continue;
    }
    if (c.type === "tool-error") {
      const existing = toolPartById.get(c.toolCallId);
      const errorText =
        c.error instanceof Error ? c.error.message : String(c.error ?? "tool failed");
      if (existing) {
        existing.state = "output-error";
        existing.errorText = errorText;
      } else {
        parts.push({
          type: `tool-${c.toolName}`,
          toolCallId: c.toolCallId,
          state: "output-error",
          errorText,
        });
      }
    }
  }

  return parts;
}
