import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// The app's metadata voice. Uppercase, wide tracking, JetBrains Mono,
// soft ink. Used for eyebrow labels ("TODAY'S CHALLENGE"), breadcrumbs
// ("← TODAY"), and pathway markers ("WEEK 14 OF 36 · SPRINT 02 · DAY 12").
//
// `tone="accent"` switches to accent color for moments of emphasis
// (nudge pattern names, milestone markers). `tone="blue"` is for the
// coach voice ("DANIEL · YOUR COACH").
export function MonoLabel({
  children,
  tone = "soft",
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  tone?: "soft" | "faint" | "ink" | "accent" | "blue";
  className?: string;
  as?: "div" | "span" | "p";
}) {
  const color =
    tone === "faint"
      ? "text-ink-faint"
      : tone === "ink"
        ? "text-ink"
        : tone === "accent"
          ? "text-accent"
          : tone === "blue"
            ? "text-blue"
            : "text-ink-soft";
  return (
    <Tag
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.2em]",
        color,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
