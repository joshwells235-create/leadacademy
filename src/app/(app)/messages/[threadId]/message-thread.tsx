"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markThreadRead } from "@/lib/messages/actions";

type Message = { id: string; sender_id: string; body: string; created_at: string };

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
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
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

    return () => { supabase.removeChannel(channel); };
  }, [threadId, currentUserId, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const body = input.trim();
    if (!body || pending) return;

    // Optimistic: add message immediately.
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    start(async () => {
      const res = await sendMessage(threadId, body);
      if ("error" in res) {
        // Remove the optimistic message on failure.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    });
  };

  return (
    <div className="flex flex-col rounded-lg border border-neutral-200 bg-white shadow-sm" style={{ height: "calc(100vh - 200px)" }}>
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
              return (
                <li key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMe ? "bg-brand-blue text-white" : "bg-brand-light text-brand-navy"
                  }`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${isMe ? "text-white/60" : "text-neutral-400"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          />
          <button type="submit" disabled={pending || !input.trim()} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
