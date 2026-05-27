"use client";

import { useEffect, useState } from "react";
import type { DensityMode } from "@/lib/design/tokens";

const STORAGE_KEY = "la-density";

// Density flips the dashboard between Focus (just TP hero + sprint +
// challenge) and Overview (full grid). Pure client state — stored in
// localStorage so it survives reloads but doesn't round-trip to the
// server. The toggle is only mounted on the dashboard route.
//
// The actual layout response to density lives in the dashboard
// component, which reads `useDensity()` and renders different grids.
// This component is the switch UI + storage; it also dispatches a
// `density-change` CustomEvent so the dashboard can react without
// prop-drilling.
export function DensityToggle() {
  // New learners default to Focus so the first paint isn't a wall of
  // seven cards. Returning learners get whatever they last chose.
  const [density, setDensity] = useState<DensityMode>("focus");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "focus" || stored === "overview") {
        setDensity(stored);
        document.documentElement.dataset.density = stored;
      } else {
        document.documentElement.dataset.density = "focus";
      }
    } catch {
      // localStorage access can throw in private-mode Safari; fall
      // back to the default.
    }
  }, []);

  function flip() {
    const next: DensityMode = density === "focus" ? "overview" : "focus";
    setDensity(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Once the learner has toggled at least once, the "Want more?"
      // hint has served its purpose. Dismiss it permanently.
      localStorage.setItem("la-density-hint-seen", "1");
    } catch {
      // ignore
    }
    document.documentElement.dataset.density = next;
    // Broadcast so cards that care about density without being re-rendered
    // by a parent can subscribe.
    window.dispatchEvent(new CustomEvent("density-change", { detail: next }));
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${density === "focus" ? "Overview" : "Focus"} density`}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]"
      style={{
        borderColor: "var(--t-rule)",
        color: "var(--t-ink)",
      }}
    >
      {density === "focus" ? "◐ Focus" : "◉ Overview"}
    </button>
  );
}

// Hook for dashboard children that need to react to density changes
// without prop-drilling. Reads the current density off the
// `<html data-density>` attribute + subscribes to the `density-change`
// event.
export function useDensity(): DensityMode {
  const [density, setDensity] = useState<DensityMode>("overview");
  useEffect(() => {
    const ds = document.documentElement.dataset.density;
    if (ds === "focus" || ds === "overview") setDensity(ds);
    function onChange(e: Event) {
      const next = (e as CustomEvent<DensityMode>).detail;
      if (next === "focus" || next === "overview") setDensity(next);
    }
    window.addEventListener("density-change", onChange as EventListener);
    return () =>
      window.removeEventListener("density-change", onChange as EventListener);
  }, []);
  return density;
}
