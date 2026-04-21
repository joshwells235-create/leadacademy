"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

export function CoachChat({
  mode,
  goalContext,
  initialConversationId,
  initialMessages,
  placeholder = "Tell your thought partner what's on your mind…",
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
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, addToolApprovalResponse } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: () => ({ mode, goalContext, conversationId }),
      prepareSendMessagesRequest: ({ api, messages, body }) => ({
        api,
        body: { messages, ...(body as object) },
      }),
    }),
    // When all pending approvals on the last assistant message are resolved,
    // auto-send the continuation so the coach can react to the decision.
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
    if (!trimmed || isStreaming) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleApproval: ApprovalHandler = async (approvalId, approved) => {
    await addToolApprovalResponse({ id: approvalId, approved });
  };

  const latestAssistantId = findLatestAssistantId(messages);

  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            {emptyHint ? (
              <p className="font-serif text-base italic leading-relaxed text-brand-navy/60">
                {emptyHint}
              </p>
            ) : (
              <>
                <figure className="max-w-md">
                  <blockquote className="font-serif text-[17px] italic leading-[1.6] text-brand-navy/70">
                    "How do I know what I think until I see what I say?"
                  </blockquote>
                  <figcaption className="mt-2 text-[11px] uppercase tracking-[0.18em] text-brand-navy/45">
                    — E. M. Forster
                  </figcaption>
                </figure>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-brand-navy/60">
                  Tell it what's on your mind. It already has the context.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {/* The signature commitment: the Thought Partner's messages are
                    typeset in the editorial serif and bordered with pink — the
                    sole place pink appears in the product. User messages stay
                    in the UI sans + brand-blue. The contrast is deliberate:
                    you type, the AI writes. */}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand-blue text-white"
                      : "border-l-[3px] border-brand-pink bg-brand-pink-light/50 pl-5 font-serif text-brand-navy"
                  }`}
                >
                  <MessageContent
                    message={m}
                    isLatestMessage={m.id === latestAssistantId}
                    onApproval={handleApproval}
                  />
                </div>
              </li>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <li className="flex justify-start" aria-live="polite">
                <div className="flex max-w-[80%] items-center gap-2 rounded-2xl border-l-[3px] border-brand-pink bg-brand-pink-light/50 px-4 py-3 pl-5 font-serif text-sm italic text-brand-navy/70">
                  <span className="flex gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-pink [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-pink [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-pink" />
                  </span>
                  <span>thinking</span>
                </div>
              </li>
            )}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border-t border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800"
        >
          <p className="font-medium">Something went wrong sending that message.</p>
          <p className="mt-0.5 text-red-700">
            This is usually a network hiccup — try sending again. If it keeps happening, reload the
            page.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-neutral-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
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
            className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-light"
          />
          <button
            type="submit"
            disabled={isStreaming || input.trim().length === 0}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
          <span>Enter to send · Shift+Enter for newline</span>
          <Link href="/dashboard" className="hover:text-neutral-700">
            Back to dashboard
          </Link>
        </div>
      </form>
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
            <div key={key}>
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
