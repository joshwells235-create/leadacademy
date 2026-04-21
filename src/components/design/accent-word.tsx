import type { ReactNode } from "react";

// The signature italic-accent phrase. Always pair italic with accent
// color; never italic without color, never color without italic. This
// component is the enforcement layer — every emphasised phrase flows
// through it so the visual rhythm is consistent across the whole app.
//
// Usage:
//   Stop being the <AccentWord>safety net.</AccentWord>
//   Good morning, Marina. <AccentWord>The sprint is landing —</AccentWord> let's look at what it's telling us.
export function AccentWord({ children }: { children: ReactNode }) {
  return (
    <span
      className="italic text-accent"
      style={{ fontFamily: "var(--font-italic)" }}
    >
      {children}
    </span>
  );
}
