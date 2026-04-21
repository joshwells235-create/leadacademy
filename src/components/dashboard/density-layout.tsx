import type { ReactNode } from "react";

// Server-rendered layout wrapper that renders both Focus and Overview
// card arrangements. CSS on <html data-density="…"> picks which tree is
// visible — no client-side branching, no flash of wrong layout, no
// dead cards when density flips.
//
// Classes (not data-attribute selectors) because Tailwind v4's PostCSS
// pipeline drops bare `[data-density-show=…]` rules. The density toggle
// in the chrome sets `document.documentElement.dataset.density`; the
// CSS rules in globals.css key off that ancestor attribute to show/hide
// these panes.
export function DensityLayout({
  focus,
  overview,
}: {
  focus: ReactNode;
  overview: ReactNode;
}) {
  return (
    <>
      <div className="density-show-focus">{focus}</div>
      <div className="density-show-overview">{overview}</div>
    </>
  );
}
