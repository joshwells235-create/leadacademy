"use client";

import { useTransition } from "react";
import { startIntakeSession } from "@/lib/intake/actions";

/**
 * Start-intake button that invokes the server action via useTransition
 * (same pattern as capstone / assessment). Avoids the form/action
 * plumbing which was silently failing in at least one environment.
 *
 * Variants let us reuse the same button across the primary dashboard
 * CTA and inline prose links on /profile without duplicating logic.
 */
type Variant = "primary" | "inline" | "ghost";

export function IntakeCtaButton({
  children,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  variant?: Variant;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const handleClick = () => {
    start(async () => {
      await startIntakeSession();
    });
  };

  const classes =
    variant === "primary"
      ? "shrink-0 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
      : variant === "inline"
        ? "text-brand-blue hover:underline disabled:opacity-60"
        : "text-xs text-neutral-600 hover:text-brand-blue disabled:opacity-60";

  return (
    <button type="button" onClick={handleClick} disabled={pending || disabled} className={classes}>
      {pending ? "Starting…" : children}
    </button>
  );
}
