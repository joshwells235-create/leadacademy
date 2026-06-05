"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LaunchTourButton } from "@/components/super/launch-tour-button";

const TUTORIAL_KEY = "la-super-tutorial-seen";

/**
 * First-run callout on the super-admin landing page (/super/orgs) that
 * points new admins at the welcome tutorial. Dismissed by the
 * tutorial page itself (when the user clicks "I've got it") OR by the
 * X button on the callout. Either way the localStorage flag persists
 * per-device, so they don't see it again on subsequent visits.
 */
export function NewAdminCallout() {
  // Default to hidden — we only show once we've confirmed the flag is
  // not set. Avoids a flash on returning admins.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_KEY) !== "1") setShow(true);
    } catch {
      // private-mode Safari etc. — silently skip
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl p-5"
      style={{
        border: "1px solid var(--t-accent)",
        background: "var(--t-accent-soft)",
      }}
      role="region"
      aria-label="New super admin welcome"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          New here?
        </p>
        <h2
          className="mt-1 text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400 }}
        >
          Take the guided tour first.
        </h2>
        <p className="mt-1 max-w-[640px] text-[13px] text-ink-soft">
          A two-minute spotlight walkthrough that points at the real buttons
          and walks you across the actual screens — orgs, cohorts, inviting
          people, the per-learner detail page, ⌘K search. Recommended before
          you start moving things around.
        </p>
        <Link
          href="/super/welcome"
          className="mt-2 inline-block text-[12px] text-accent underline"
        >
          Prefer to read? Full written reference →
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LaunchTourButton>Start the tour →</LaunchTourButton>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(TUTORIAL_KEY, "1");
            } catch {
              // ignore
            }
            setShow(false);
          }}
          aria-label="Dismiss"
          className="rounded-full px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
          style={{ border: "1px solid var(--t-rule)" }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
