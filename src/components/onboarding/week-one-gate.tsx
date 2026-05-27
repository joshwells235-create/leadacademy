"use client";

import type { ReactNode } from "react";
import { useOnboardingSkipped, WeekOnePanel, type WeekOneStep } from "./week-one";

/**
 * Client-side gate that swaps between the locked Week One panel and
 * the regular dashboard based on:
 *   1. Server-known progress (`steps`) — if all five are done, render
 *      the regular dashboard regardless.
 *   2. Per-device skip flag (localStorage) — if the learner has
 *      explicitly clicked "Skip onboarding," render the regular
 *      dashboard.
 *
 * SSR default renders the panel for safety (so a learner with JS
 * disabled still sees the path). The hook flips to skipped state
 * after hydration; no flash of wrong content because the regular
 * dashboard is already in the children tree.
 */
export function WeekOneGate({
  steps,
  children,
}: {
  steps: WeekOneStep[];
  children: ReactNode;
}) {
  const skipped = useOnboardingSkipped();
  const allDone = steps.every((s) => s.done);

  // During SSR / before hydration `skipped` is null. Render the panel
  // by default so the locked experience holds; the regular dashboard
  // hydrates in once the client confirms the skip flag is unset.
  const showPanel = !allDone && skipped !== true;

  if (showPanel) {
    return <WeekOnePanel steps={steps} />;
  }
  return <>{children}</>;
}
