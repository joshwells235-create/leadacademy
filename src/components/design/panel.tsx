import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// The house panel. Themed surface, themed radius, themed shadow — all
// driven by CSS variables so the same <Panel> renders as a print-crisp
// paper card in Editorial and a glassmorphic float in Cinematic.
//
// `glow` opts into the accent halo used on the TP hero. `style` is
// allowed only for layout hints (borderLeft, padding overrides); don't
// pass colors through style — reach for variable references like
// `var(--t-blue)` if you must, so theme swaps still work.
export function Panel({
  children,
  className,
  glow,
  style,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border p-7 backdrop-blur-[20px]",
        "dark:backdrop-blur-[20px]",
        className,
      )}
      style={{
        background: "var(--t-paper)",
        borderColor: "var(--t-rule)",
        borderRadius: "var(--t-radius)",
        boxShadow: glow
          ? "var(--t-panel-shadow), 0 0 40px var(--t-accent-soft)"
          : "var(--t-panel-shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
