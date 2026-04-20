"use client";

import { useEffect, useRef, useState } from "react";
import { stampScrollPosition } from "@/lib/learning/note-actions";

/**
 * LMS Phase D3 — scroll-position resume.
 *
 * On mount: if the learner has a stored `last_scroll_pct` for this
 * lesson and it's > 5%, offer a one-click "Jump to where you left off"
 * chip instead of silently scrolling (silent teleports are jarring). On
 * click: smooth-scroll to the stored fraction.
 *
 * During the session: throttled scroll listener stamps the current
 * fraction every ~1.5s, fire-and-forget. Skips trivial early-page
 * positions so we don't overwrite a meaningful resume point with
 * noise from the learner scrolling back to the top.
 */

const STAMP_THROTTLE_MS = 1500;
const MIN_RESUME_PCT = 5;
const MIN_STAMP_PCT = 3;

type Props = {
  lessonId: string;
  initialPct: number | null;
};

export function ScrollResume({ lessonId, initialPct }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const lastStampedRef = useRef<number>(initialPct ?? 0);
  const lastStampAtRef = useRef<number>(0);

  // Throttled stamping on scroll.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const computePct = (): number => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      if (scrollHeight <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((scrollTop / scrollHeight) * 100)));
    };

    const maybeStamp = () => {
      const pct = computePct();
      if (pct < MIN_STAMP_PCT) return;
      if (Math.abs(pct - lastStampedRef.current) < 2) return;
      const now = Date.now();
      if (now - lastStampAtRef.current < STAMP_THROTTLE_MS) return;
      lastStampAtRef.current = now;
      lastStampedRef.current = pct;
      void stampScrollPosition({ lessonId, pct });
    };

    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(maybeStamp, 250);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      // Flush on unmount so the last-seen position is saved even if the
      // user leaves mid-throttle.
      const pct = computePct();
      if (pct >= MIN_STAMP_PCT && Math.abs(pct - lastStampedRef.current) >= 2) {
        void stampScrollPosition({ lessonId, pct });
      }
    };
  }, [lessonId]);

  const resume = () => {
    if (initialPct == null) return;
    const doc = document.documentElement;
    const target = ((doc.scrollHeight - doc.clientHeight) * initialPct) / 100;
    window.scrollTo({ top: target, behavior: "smooth" });
    setDismissed(true);
  };

  if (dismissed || initialPct == null || initialPct < MIN_RESUME_PCT) return null;

  return (
    <div className="sticky top-2 z-30 mb-3 flex justify-end">
      <button
        type="button"
        onClick={resume}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-white px-3 py-1 text-xs font-medium text-brand-blue shadow-sm hover:bg-brand-blue/5"
      >
        ↓ Jump to where you left off ({initialPct}%)
      </button>
    </div>
  );
}
