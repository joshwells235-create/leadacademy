"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IntakeCtaButton } from "@/components/intake/intake-cta-button";

const SKIP_KEY = "la-onboarding-skipped";

export type StepKey = "intake" | "assessment" | "conversation" | "goal" | "moment";

export type WeekOneStep = {
  key: StepKey;
  /** True if the underlying server signal says this step is complete. */
  done: boolean;
  /** Where the CTA button navigates. */
  href: string;
};

/**
 * Locked linear onboarding for new learners. Shows five steps that
 * must be completed in order before the regular dashboard appears.
 * The locked-by-default behavior comes from the dashboard page itself
 * — when the Week One panel is rendered, the rest of the dashboard
 * (cards, density toggle, etc.) is suppressed.
 *
 * Safety hatches:
 *   - "Skip onboarding" button at the bottom flips a localStorage
 *     flag. The dashboard reads `useOnboardingSkipped()` and bails out
 *     of the locked layout once flipped. Per-device, no backend
 *     writes — keeps brokenness risk low. If the user clears it /
 *     switches devices, completion signals still flow from the server
 *     so already-completed steps stay ✓ and they'll only see what's
 *     genuinely left.
 *   - Super admins never see this panel (escape hatch lives in the
 *     dashboard page, not here).
 */
export function WeekOnePanel({ steps }: { steps: WeekOneStep[] }) {
  const [skipped, setSkipped] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // On mount, check localStorage. If the user has previously skipped,
  // self-hide so the parent can render the regular dashboard. The
  // parent reads the same flag and short-circuits, but during the
  // hydration window we want a clean fallback.
  useEffect(() => {
    try {
      if (localStorage.getItem(SKIP_KEY) === "1") setSkipped(true);
    } catch {
      // private-mode Safari — fall through to rendering
    }
  }, []);

  if (skipped) return null;

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return (
    <section
      className="mt-7 rounded-2xl p-7"
      style={{
        border: "1px solid var(--t-rule)",
        background: "var(--t-paper)",
      }}
      aria-label="Week one walkthrough"
    >
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Week one · {completed} of {total} complete
        </p>
        <h2
          className="mt-2 text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400 }}
        >
          Set the foundation for the program.
        </h2>
        <p className="mt-2 max-w-[640px] text-sm text-ink-soft">
          Do these in order. Each one teaches the thought partner something it'll
          use in every conversation that follows. The whole sequence takes about
          twenty minutes.
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((step, idx) => {
          const isNext = !step.done && nextStep?.key === step.key;
          return (
            <li
              key={step.key}
              className="rounded-xl p-4"
              style={{
                border: `1px solid ${isNext ? "var(--t-accent)" : "var(--t-rule)"}`,
                background: isNext ? "var(--t-accent-soft)" : "transparent",
                opacity: step.done ? 0.7 : 1,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background: step.done
                        ? "var(--t-blue)"
                        : isNext
                          ? "var(--t-accent)"
                          : "var(--t-ink)",
                    }}
                    aria-hidden
                  >
                    {step.done ? "✓" : idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {LABELS[step.key].title}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {LABELS[step.key].description}
                    </p>
                  </div>
                </div>
                {step.done ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-blue">
                    Done
                  </span>
                ) : isNext ? (
                  step.key === "intake" ? (
                    // Intake needs a server action (startIntakeSession)
                    // rather than a plain link — same path the main
                    // dashboard intake CTA uses.
                    <IntakeCtaButton>
                      {LABELS[step.key].cta} →
                    </IntakeCtaButton>
                  ) : (
                    <Link
                      href={step.href}
                      className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium text-white"
                      style={{ background: "var(--t-accent)" }}
                    >
                      {LABELS[step.key].cta} →
                    </Link>
                  )
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                    Locked
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Always-visible safety hatch. The plan is "locked path" but
          "locked-but-not-jailing" — if any step breaks, the learner
          can still get to the dashboard. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] italic text-ink-faint">
          Stuck or just want to look around first?
        </p>
        {confirming ? (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-ink-soft">Skip onboarding?</span>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(SKIP_KEY, "1");
                } catch {
                  // ignore
                }
                setSkipped(true);
              }}
              className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-white"
              style={{ background: "var(--t-ink)" }}
            >
              Yes, skip
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft hover:text-ink"
          >
            Skip onboarding →
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Hook the dashboard page uses to decide whether to render the locked
 * Week One layout or the regular dashboard. Reads the same
 * localStorage flag the panel's "skip" button writes. Returns null on
 * the server / before hydration so the dashboard can safely render
 * the locked layout as the SSR default — the regular dashboard takes
 * over only after the client confirms the skip flag.
 */
export function useOnboardingSkipped(): boolean | null {
  const [skipped, setSkipped] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setSkipped(localStorage.getItem(SKIP_KEY) === "1");
    } catch {
      setSkipped(false);
    }
  }, []);
  return skipped;
}

const LABELS: Record<
  StepKey,
  { title: string; description: string; cta: string }
> = {
  intake: {
    title: "Tell your thought partner who you are",
    description:
      "Nine short questions so every future exchange already knows your role, team, and what you're working on.",
    cta: "Start intake",
  },
  assessment: {
    title: "Upload one assessment report",
    description:
      "PI, EQ-i, or 360 — even one grounds every conversation in real data instead of generic advice.",
    cta: "Upload a report",
  },
  conversation: {
    title: "Have your first conversation",
    description:
      "Talk through anything that's on your mind. The thought partner already has your intake + assessment.",
    cta: "Open thought partner",
  },
  goal: {
    title: "Set your first growth goal",
    description:
      "Three lenses — how it changes you, your team, and the organization. Your thought partner drafts it with you.",
    cta: "Draft a goal",
  },
  moment: {
    title: "Log your first moment",
    description:
      "Start a sprint and capture one moment of the behavior you're practicing. That's where change becomes visible.",
    cta: "Go to your goal",
  },
};
