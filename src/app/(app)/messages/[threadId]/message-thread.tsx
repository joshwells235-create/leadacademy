"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { markThreadRead, sendMessage } from "@/lib/messages/actions";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  status?: "sent" | "pending" | "failed";
};

export function MessageThread({
  threadId,
  currentUserId,
  initialMessages,
  otherName,
}: {
  threadId: string;
  currentUserId: string;
  initialMessages: Message[];
  otherName: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Subscribe to new messages in this thread via Realtime.
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates (we might have already added it optimistically).
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mark as read when we receive a message while viewing.
          if (newMsg.sender_id !== currentUserId) {
            markThreadRead(threadId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, currentUserId, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const doSend = (body: string, optimisticId: string) => {
    start(async () => {
      const res = await sendMessage(threadId, body);
      if ("error" in res) {
        // Mark the optimistic message failed so the learner can see it and
        // retry — silently dropping it (old behavior) made send failures
        // invisible.
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: "failed" } : m)),
        );
      }
      // Realtime will deliver the real row; we leave the optimistic in
      // place and dedupe in the INSERT handler.
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const body = input.trim();
    if (!body || pending) return;

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
      status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    doSend(body, optimistic.id);
  };

  const handleRetry = (msg: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: "pending" } : m)));
    doSend(msg.body, msg.id);
  };

  const handleDiscard = (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  return (
    <div
      className="flex flex-col rounded-lg border border-neutral-200 bg-white shadow-sm"
      style={{ height: "min(calc(100dvh - 200px), 720px)" }}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Start a conversation with {otherName}.
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const isMe = m.sender_id === currentUserId;
              const failed = m.status === "failed";
              const pendingSend = m.status === "pending";
              return (
                <li key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      failed
                        ? "bg-red-50 text-red-900 ring-1 ring-red-200"
                        : isMe
                          ? "bg-brand-blue text-white"
                          : "bg-brand-light text-brand-navy"
                    } ${pendingSend ? "opacity-70" : ""}`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        failed ? "text-red-700" : isMe ? "text-white/60" : "text-neutral-400"
                      }`}
                    >
                      {failed ? (
                        <>Didn't send — check your connection.</>
                      ) : pendingSend ? (
                        "Sending…"
                      ) : (
                        formatMessageTimestamp(m.created_at)
                      )}
                    </p>
                    {failed && (
                      <div className="mt-1 flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleRetry(m)}
                          className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscard(m.id)}
                          className="rounded border border-red-200 bg-white px-2 py-0.5 text-red-800 hover:bg-red-50"
                        >
                          Discard
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      {/* Send form */}
      <form onSubmit={handleSend} className="border-t border-neutral-200 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${otherName}...`}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function formatMessageTimestamp(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const time = then.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate();
  if (isYesterday) return `Yesterday ${time}`;
  const thisYear = then.getFullYear() === now.getFullYear();
  const date = then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: thisYear ? undefined : "numeric",
  });
  return `${date} ${time}`;
}
