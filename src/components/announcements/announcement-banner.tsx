"use client";

import { useTransition } from "react";
import { dismissAnnouncement } from "@/lib/super/announcement-actions";

type Tone = "info" | "warning" | "success";

type Announcement = {
  id: string;
  title: string;
  body: string;
  tone: Tone;
};

const TONE_STYLES: Record<Tone, { container: string; title: string }> = {
  info: {
    container: "border-brand-blue/30 bg-brand-blue/5",
    title: "text-brand-blue",
  },
  warning: {
    container: "border-amber-300 bg-amber-50",
    title: "text-amber-900",
  },
  success: {
    container: "border-emerald-300 bg-emerald-50",
    title: "text-emerald-900",
  },
};

export function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const [pending, start] = useTransition();
  const styles = TONE_STYLES[announcement.tone];

  const dismiss = () => {
    start(async () => {
      await dismissAnnouncement(announcement.id);
    });
  };

  return (
    <div
      role="status"
      className={`rounded-lg border p-4 ${styles.container}`}
      aria-label={announcement.title}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={`text-sm font-semibold ${styles.title}`}>{announcement.title}</h2>
          <p className="mt-1 text-sm text-neutral-700 whitespace-pre-wrap">{announcement.body}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="shrink-0 text-xs text-neutral-500 hover:text-brand-navy disabled:opacity-60"
          aria-label="Dismiss announcement"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
