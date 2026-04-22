"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { useEffect, useRef, useState } from "react";
import { ThinkingDots } from "@/components/design/thinking-dots";
import { TPOrb } from "@/components/design/tp-orb";
import type { AttachmentSummary } from "@/lib/ai/attachments/types";
import { AttachmentPicker } from "./attachment-picker";
import { type ApprovalHandler, renderToolPart, type ToolPart } from "./tool-renderers";

type Mode =
  | "general"
  | "goal"
  | "reflection"
  | "assessment"
  | "capstone"
  | "intake"
  | "debrief"
  | "coach_partner";

// The Thought Partner chat surface, reskinned to the editorial system.
// Core behaviour unchanged — streaming via AI SDK's useChat, tool-call
// renderers with approval-pill replay, auto-send after resolved
// approvals, x-conversation-id header capture for first-turn persistence.
//
// Visual principles (from the handoff):
//   • TP messages flow as Fraunces serif in a max-720px column with a
//     still orb to the left. No bubble — the type is the voice.
//   • User messages render as a right-aligned pill (max 75%). Ink
//     background in Editorial, white/8% in Cinematic. Tight, not shouty.
//   • Thinking = orb + three pulsing dots on a 1.2s stagger.
//   • Composer sits inside the same 720px column. Textarea uses the
//     paper surface; send button is accent pink.
export function CoachChat({
  mode,
  goalContext,
  initialConversationId,
  initialMessages,
  placeholder = "Think out loud…",
  emptyHint,
}: {
  mode: Mode;
  goalContext?: { primaryLens?: "self" | "others" | "org"; goalId?: string };
  initialConversationId?: string;
  initialMessages?: UIMessage[];
  placeholder?: string;
  emptyHint?: React.ReactNode;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentSummary[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep a ref of the latest attachment ids so the `body` closure
  // inside useChat always reads the current value. Without the ref,
  // `body` captures the initial empty array and attachments never
  // make it into the request.
  const attachmentIdsRef = useRef<string[]>([]);
  useEffect(() => {
    attachmentIdsRef.current = attachments.map((a) => a.id);
  }, [attachments]);

  const { messages, sendMessage, status, error, addToolApprovalResponse } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: () => ({
        mode,
        goalContext,
        conversationId,
        attachmentIds: attachmentIdsRef.current,
      }),
      prepareSendMessagesRequest: ({ api, messages, body }) => ({
        api,
        body: { messages, ...(body as object) },
      }),
    }),
    // When every pending approval on the last assistant message is
    // resolved, auto-send the continuation so the thought partner can
    // react to the decision in the same turn.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ message }) => {
      const conversationFromHeader = (
        message as unknown as { _responseHeaders?: Record<string, string> }
      )?._responseHeaders?.["x-conversation-id"];
      if (conversationFromHeader && !conversationId) {
        setConversationId(conversationFromHeader);
      }
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger scroll on each messages update
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    // Allow sending with attachments and no typed text — learners
    // sometimes just drop a transcript in and wait for the TP to read
    // it. A blank send without either is still a no-op.
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;
    // If there's no typed text, provide a minimal placeholder so the
    // AI SDK has a non-empty user message to send. The server-side
    // attachment-prefix text will land on the same message.
    const textToSend =
      trimmed ||
      (attachments.length === 1
        ? `I've attached ${attachments[0].filename}.`
        : `I've attached ${attachments.length} files.`);
    sendMessage({ text: textToSend });
    setInput("");
    // Clear the committed attachments from the composer — they move
    // onto the just-sent message. On resume the server rehydrates
    // them onto the same message via message_id linkage.
    setAttachments([]);
  };

  const handleApproval: ApprovalHandler = async (approvalId, approved) => {
    await addToolApprovalResponse({ id: approvalId, approved });
  };

  const latestAssistantId = findLatestAssistantId(messages);

  return (
    <div className="flex h-full min-h-[70vh] flex-col">
      {/* Message column — scroll area. Fills available height; composer
          sits below as a separate flex child. */}
      <div className="flex-1 overflow-y-auto px-6 py-10 lg:px-16 lg:py-12">
        <div className="mx-auto max-w-[720px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              {emptyHint ? (
                <div
                  className="max-w-md italic leading-relaxed text-ink-soft"
                  style={{ fontFamily: "var(--font-italic)", fontSize: 17 }}
                >
                  {emptyHint}
                </div>
              ) : (
                <>
                  <figure className="max-w-md">
                    <blockquote
                      className="italic leading-[1.6] text-ink-soft"
                      style={{ fontFamily: "var(--font-italic)", fontSize: 17 }}
                    >
                      "How do I know what I think until I see what I say?"
                    </blockquote>
                    <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                      — E. M. Forster
                    </figcaption>
                  </figure>
                  <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-soft">
                    Tell it what's on your mind. It already has the context.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-7">
              {messages.map((m) => (
                <li key={m.id}>
                  {m.role === "user" ? (
                    <UserMessage>
                      <MessageContent
                        message={m}
                        isLatestMessage={m.id === latestAssistantId}
                        onApproval={handleApproval}
                      />
                    </UserMessage>
                  ) : (
                    <TPMessage>
                      <MessageContent
                        message={m}
                        isLatestMessage={m.id === latestAssistantId}
                        onApproval={handleApproval}
                      />
                    </TPMessage>
                  )}
                </li>
              ))}
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <li aria-live="polite">
                  <ThinkingDots />
                </li>
              )}
              <div ref={endRef} />
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="px-6 py-3 text-xs lg:px-16"
          style={{
            borderTop: "1px solid var(--t-rule)",
            background: "var(--t-accent-soft)",
            color: "var(--t-accent)",
          }}
        >
          <div className="mx-auto max-w-[720px]">
            <p className="font-medium">Something got in the way of that thought.</p>
            <p className="mt-0.5 opacity-80">
              Usually a network hiccup — try again. If it keeps happening, reload.
            </p>
          </div>
        </div>
      )}

      {/* Composer — same max-720px container as the messages so the
          textarea lines up under the conversation. Paper-surface text
          field, accent send button. Enter sends, Shift+Enter newlines.
          AttachmentPicker lives above the textarea: it renders the
          paperclip trigger, chip row, and one-time privacy notice as
          a self-contained unit. */}
      <form
        onSubmit={handleSubmit}
        className="px-6 py-6 lg:px-16 lg:py-7"
        style={{ borderTop: "1px solid var(--t-rule)" }}
      >
        <div className="mx-auto max-w-[720px]">
          <div className="mb-3">
            <AttachmentPicker
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              conversationId={conversationId}
              disabled={isStreaming}
            />
          </div>
        </div>
        <div className="mx-auto flex max-w-[720px] items-end gap-2.5">
          <label htmlFor="tp-composer" className="sr-only">
            Message your thought partner
          </label>
          <textarea
            id="tp-composer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={placeholder}
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none p-4 text-[14.5px] leading-[1.5] text-ink outline-none disabled:opacity-70"
            style={{
              background: "var(--t-paper)",
              border: "1px solid var(--t-rule)",
              borderRadius: 14,
              minHeight: 52,
              maxHeight: 200,
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            disabled={isStreaming || input.trim().length === 0}
            className="inline-flex items-center rounded-[14px] px-5 py-3.5 text-[14px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--t-accent)" }}
          >
            Send ↵
          </button>
        </div>
        <div className="mx-auto mt-2 max-w-[720px] text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Enter to send · Shift + Enter for newline
          </span>
        </div>
      </form>
    </div>
  );
}

// A TP message — Fraunces 17 flowing in the column with a still orb at
// the left as the voice marker. No bubble, no bordered surface: the
// type and the orb together are the visual signature.
function TPMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <TPOrb size={28} />
      <div
        className="flex-1 text-ink"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 17,
          lineHeight: 1.55,
          fontWeight: 400,
          letterSpacing: "-0.005em",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// User message — right-aligned pill bubble, max 75% width. Surface +
// text color swap between Editorial (ink pill, white text) and
// Cinematic (translucent white pill, 95% white text) via the
// `--t-user-bubble` / `--t-user-bubble-text` variables so the
// component itself stays theme-agnostic.
function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[75%] rounded-2xl px-4 py-3 text-[14.5px] leading-[1.5]"
        style={{
          background: "var(--t-user-bubble)",
          color: "var(--t-user-bubble-text)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function findLatestAssistantId(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i].id;
  }
  return null;
}

type GenericPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | ({ type: string } & Record<string, unknown>);

function MessageContent({
  message,
  isLatestMessage,
  onApproval,
}: {
  message: { id: string; parts?: unknown[]; role: string };
  isLatestMessage: boolean;
  onApproval: ApprovalHandler;
}) {
  const parts = (message.parts ?? []) as GenericPart[];

  return (
    <>
      {parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === "text") {
          return (
            <p key={key} className="whitespace-pre-wrap">
              {(part as { text: string }).text}
            </p>
          );
        }
        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          return (
            <div key={key} className="mt-3">
              {renderToolPart({
                part: part as unknown as ToolPart,
                isLatestMessage,
                onApproval,
              })}
            </div>
          );
        }
        return null;
      })}
    </>
  );
}
