"use client";

import { useState } from "react";

const TUTORIAL_KEY = "la-super-tutorial-seen";

/**
 * Flips the localStorage flag the /super/orgs callout reads. Once a
 * super admin clicks this, the new-admin banner stops showing for
 * them. Per-device, no backend column — they can revisit the tutorial
 * any time via the Portals dropdown.
 */
export function WelcomeDismiss() {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(TUTORIAL_KEY, "1");
        } catch {
          // private-mode Safari — ignore
        }
        setDone(true);
      }}
      className="inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium text-white"
      style={{ background: done ? "var(--t-ink)" : "var(--t-accent)" }}
    >
      {done ? "✓ Done — go explore" : "I've got it — dismiss this"}
    </button>
  );
}
