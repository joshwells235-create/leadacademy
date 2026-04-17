"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/messages/actions";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({ userId, initialCount }: { userId: string; initialCount: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();
  const supabase = createClient();

  // Subscribe to new notifications via Realtime.
  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  // Load notifications when dropdown opens.
  const loadNotifications = async () => {
    if (loaded) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
    setLoaded(true);
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) loadNotifications();
  };

  const handleMarkRead = (id: string) => {
    start(async () => {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    });
  };

  const handleMarkAll = () => {
    start(async () => {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      setUnreadCount(0);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-md p-1.5 text-white/75 hover:text-white transition"
        title="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-pink text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2">
              <h3 className="text-sm font-semibold text-brand-navy">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAll} disabled={pending} className="text-xs text-brand-blue hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-500">No notifications yet.</p>
              ) : (
                <ul>
                  {notifications.map((n) => (
                    <li key={n.id} className={`border-b border-neutral-50 ${!n.read_at ? "bg-brand-blue-light/50" : ""}`}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => { if (!n.read_at) handleMarkRead(n.id); setOpen(false); }}
                          className="block px-4 py-3 hover:bg-brand-light transition"
                        >
                          <NotificationContent n={n} />
                        </Link>
                      ) : (
                        <div
                          className="px-4 py-3 cursor-pointer hover:bg-brand-light transition"
                          onClick={() => { if (!n.read_at) handleMarkRead(n.id); }}
                        >
                          <NotificationContent n={n} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationContent({ n }: { n: Notification }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-brand-navy">{n.title}</p>
        {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />}
      </div>
      <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{n.body}</p>
      <p className="mt-1 text-[10px] text-neutral-400">{timeAgo(n.created_at)}</p>
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
