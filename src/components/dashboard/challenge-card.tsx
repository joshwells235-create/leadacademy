"use client";

import { useEffect, useState, useTransition } from "react";
import { Panel } from "@/components/design/panel";
import { completeDailyChallenge } from "@/lib/reflections/actions";

// Today's challenge, reskinned for the dashboard. Mono eyebrow, serif
// challenge sentence, 7-segment streak bar, mono footer with streak
// count + "mark done" action. Preserves the existing fetch + complete
// API so the server-side widget contract doesn't change.
//
// Compact vs full differs only in type scale — the card is otherwise
// identical. In Focus mode we bump the serif a notch so the card
// carries more visual weight alongside the sprint card.
type Challenge = {
  id: string;
  challenge: string;
  completed: boolean;
  completed_at: string | null;
  reflection: string | null;
  for_date: string;
};

export function ChallengeCard({
  compact,
  initialStreak,
}: {
  compact?: boolean;
  /** 7-day-window streak count, computed server-side. The parent reads
   *  `daily_challenges` for completed counts in the last 7 days and
   *  passes it through so we don't need a second endpoint. */
  initialStreak: number;
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, startComplete] = useTransition();
  const [streak, setStreak] = useState<number>(initialStreak);

  useEffect(() => {
    fetch("/api/ai/daily-challenge")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "failed to load");
        }
        return res.json();
      })
      .then((data) => setChallenge(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleComplete = () => {
    if (!challenge) return;
    startComplete(async () => {
      await completeDailyChallenge(challenge.id);
      setChallenge((prev) => (prev ? { ...prev, completed: true } : prev));
      setStreak((s) => Math.min(7, s + 1));
    });
  };

  return (
    <Panel>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Today's challenge
      </p>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div
            className="h-4 w-3/4 animate-pulse rounded"
            style={{ background: "var(--t-rule)" }}
          />
          <div
            className="h-4 w-1/2 animate-pulse rounded"
            style={{ background: "var(--t-rule)" }}
          />
        </div>
      ) : error || !challenge ? (
        <p className="mt-3 text-[13.5px] leading-[1.5] text-ink-soft">
          Your thought partner is drafting today's challenge. Check back in a moment.
        </p>
      ) : (
        <p
          className="mt-3 text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: compact ? 22 : 19,
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}
        >
          {challenge.challenge}
        </p>
      )}

      {/* 7-segment streak bar. Each segment is a day in the last 7;
          filled in accent pink = completed day. */}
      <div className="mt-5 flex gap-[5px]">
        {Array.from({ length: 7 }, (_, i) => {
          const filled = i < Math.min(7, streak);
          return (
            <div
              key={i}
              className="h-1 flex-1 rounded-[1px]"
              style={{ background: filled ? "var(--t-accent)" : "var(--t-rule)" }}
            />
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em]">
        <span className="text-ink-soft">
          {streak === 0 ? "Fresh start" : `${streak}-day streak`}
        </span>
        {challenge?.completed ? (
          <span className="text-ink-faint">Done today</span>
        ) : challenge ? (
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            className="text-accent transition hover:opacity-80 disabled:opacity-50"
          >
            {completing ? "Marking…" : "Mark done →"}
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
