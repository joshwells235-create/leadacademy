"use client";

import { useRouter } from "next/navigation";
import { TOUR_START_EVENT } from "./super-tour";

const ACTIVE_KEY = "la-super-tour-active";
const STEP_KEY = "la-super-tour-step";

/**
 * Launches the spotlight tour: sets the persistence flags, fires the
 * custom event the SuperTour engine (mounted in the app layout) listens
 * for, and navigates to /super/orgs where the tour begins. Same-tab
 * localStorage writes don't fire storage events, so the custom event is
 * how we tell the already-mounted engine to wake up.
 */
export function LaunchTourButton({
  children,
  variant = "primary",
  className,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
  /** Fired before launch — used by menu items to close themselves. */
  onClick?: () => void;
}) {
  const router = useRouter();

  const launch = () => {
    onClick?.();
    try {
      localStorage.setItem(ACTIVE_KEY, "1");
      localStorage.setItem(STEP_KEY, "0");
    } catch {
      // ignore — the event still starts the in-memory tour
    }
    window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
    // Begin on the super home base. If already there, the engine renders
    // immediately; otherwise this navigation lands us on step 1's page.
    router.push("/super/orgs");
  };

  const base =
    variant === "primary"
      ? "inline-flex items-center rounded-full px-4 py-2 text-xs font-medium text-white"
      : "inline-flex items-center rounded-full border px-4 py-2 text-xs font-medium text-ink-soft hover:text-ink transition";

  return (
    <button
      type="button"
      onClick={launch}
      className={className ?? base}
      style={
        variant === "primary"
          ? { background: "var(--t-accent)" }
          : { borderColor: "var(--t-rule)" }
      }
    >
      {children}
    </button>
  );
}
