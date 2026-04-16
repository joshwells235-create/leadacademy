"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

type Mode = "general" | "goal";

export function CoachChat({
  mode,
  goalContext,
  initialConversationId,
  placeholder = "Tell the coach what's on your mind…",
  emptyHint,
}: {
  mode: Mode;
  goalContext?: { primaryLens?: "self" | "others" | "org"; goalId?: string };
  initialConversationId?: string;
  placeholder?: string;
  emptyHint?: React.ReactNode;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: () => ({ mode, goalContext, conversationId }),
      prepareSendMessagesRequest: ({ api, messages, body }) => ({
        api,
        body: { messages, ...(body as object) },
      }),
    }),
    onFinish: ({ message }) => {
      // Capture the server-assigned conversationId from custom response header.
      const conversationFromHeader = (message as unknown as { _responseHeaders?: Record<string, string> })
        ?._responseHeaders?.["x-conversation-id"];
      if (conversationFromHeader && !conversationId) {
        setConversationId(conversationFromHeader);
      }
    },
  });

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

  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-neutral-500">
            {emptyHint ?? "Say hello — the coach is ready."}
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  <MessageContent message={m} />
                </div>
              </li>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <li className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-neutral-100 px-4 py-2 text-sm italic text-neutral-500">
                  thinking…
                </div>
              </li>
            )}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error.message}
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
            className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50"
          />
          <button
            type="submit"
            disabled={isStreaming || input.trim().length === 0}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
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

function MessageContent({ message }: { message: { parts?: unknown[]; role: string } }) {
  const parts = (message.parts ?? []) as Array<
    | { type: "text"; text: string }
    | { type: "reasoning"; text: string }
    | { type: "tool-finalize_goal"; state?: string; output?: { id?: string; title?: string; error?: string } }
    | { type: string; [key: string]: unknown }
  >;

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {(part as { text: string }).text}
            </p>
          );
        }
        if (part.type === "tool-finalize_goal") {
          const p = part as {
            state?: string;
            output?: { id?: string; title?: string; error?: string };
          };
          if (p.state === "output-available" && p.output) {
            if (p.output.error) {
              return (
                <p key={i} className="mt-1 text-red-700">
                  Couldn't save goal: {p.output.error}
                </p>
              );
            }
            return (
              <p key={i} className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900">
                ✓ Saved goal: <strong>{p.output.title}</strong>
              </p>
            );
          }
          return (
            <p key={i} className="mt-1 text-neutral-500 italic">
              saving goal…
            </p>
          );
        }
        return null;
      })}
    </>
  );
}
