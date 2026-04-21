"use client";

import { useTransition } from "react";
import { setThemeMode } from "@/lib/design/theme-actions";
import type { ThemeMode } from "@/lib/design/tokens";

// Top-chrome toggle for the Editorial ↔ Cinematic theme. Optimistically
// flips the `data-theme` attribute on <html> so the transition feels
// instant (0.6s CSS cross-fade via the `transition` on body), then
// persists the change to `profiles.theme_mode` in the background.
//
// We don't reach for `next/navigation`'s router.refresh() — the CSS
// variables drive every themed utility, so a swapped `data-theme`
// attribute is sufficient to re-style the page. The revalidatePath
// inside the server action keeps future requests in sync.
export function ModeToggle({ current }: { current: ThemeMode }) {
  const [isPending, start] = useTransition();

  function flip() {
    const next: ThemeMode = current === "cinematic" ? "editorial" : "cinematic";
    document.documentElement.dataset.theme = next;
    start(async () => {
      await setThemeMode(next);
    });
  }

  const label = current === "cinematic" ? "Cinematic" : "Editorial";

  return (
    <button
      type="button"
      onClick={flip}
      disabled={isPending}
      aria-label={`Switch to ${current === "cinematic" ? "Editorial" : "Cinematic"} mode`}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] disabled:opacity-60"
      style={{
        borderColor: "var(--t-rule)",
        color: "var(--t-ink)",
      }}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: "var(--t-accent)" }}
      />
      {label}
    </button>
  );
}
