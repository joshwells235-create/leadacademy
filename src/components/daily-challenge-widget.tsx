"use client";

import { useEffect, useState, useTransition } from "react";
import { completeDailyChallenge } from "@/lib/reflections/actions";

type Challenge = {
  id: string;
  challenge: string;
  completed: boolean;
  completed_at: string | null;
  reflection: string | null;
  for_date: string;
};

export function DailyChallengeWidget() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, startComplete] = useTransition();
  const [reflectionText, setReflectionText] = useState("");
  const [showReflection, setShowReflection] = useState(false);

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
      await completeDailyChallenge(challenge.id, reflectionText.trim() || undefined);
      setChallenge((prev) => (prev ? { ...prev, completed: true } : prev));
      setShowReflection(false);
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-neutral-500">Loading today's challenge…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Couldn't load challenge: {error}
      </div>
    );
  }

  if (!challenge) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Today's challenge</h2>
          <p className="mt-1 text-xs text-neutral-500">{challenge.for_date}</p>
        </div>
        {challenge.completed && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
            done
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-neutral-900">{challenge.challenge}</p>

      {!challenge.completed && (
        <div className="mt-4">
          {showReflection ? (
            <div className="space-y-2">
              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="How did it go? (optional)"
                rows={2}
                className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completing}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {completing ? "Saving…" : "Mark complete"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReflection(false)}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowReflection(true)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              I did it
            </button>
          )}
        </div>
      )}

      {challenge.completed && challenge.reflection && (
        <p className="mt-3 text-xs italic text-neutral-600">{challenge.reflection}</p>
      )}
    </div>
  );
}
