"use client";

import { useEffect, useState } from "react";

const HINT_KEY = "la-density-hint-seen";

/**
 * One-time educational nudge for the density toggle. Renders an italic
 * line at the bottom of the focus column the first time a learner sees
 * the dashboard, pointing them at the toggle in the top-right.
 *
 * Dismissal lands in localStorage in two places:
 *   - here, when the learner taps "got it"
 *   - inside DensityToggle.flip(), the moment they toggle for the first
 *     time (whichever happens first — both write the same key)
 */
export function DensityHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(HINT_KEY);
      if (!seen) setShow(true);
    } catch {
      // private-mode Safari etc — silently skip
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
      style={{
        border: "1px dashed var(--t-rule)",
        background: "transparent",
      }}
      role="note"
    >
      <p
        className="italic text-ink-soft"
        style={{ fontFamily: "var(--font-italic)", fontSize: 13 }}
      >
        Want more on the page? Tap{" "}
        <span
          className="not-italic font-mono"
          style={{ fontSize: 11, letterSpacing: "0.1em" }}
        >
          ◉ OVERVIEW
        </span>{" "}
        in the top bar for the full inventory.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(HINT_KEY, "1");
          } catch {
            // ignore
          }
          setShow(false);
        }}
        className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft hover:text-ink"
        style={{ border: "1px solid var(--t-rule)" }}
      >
        Got it
      </button>
    </div>
  );
}
