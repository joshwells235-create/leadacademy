"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The house modal for every signature moment — Log a Moment,
// TP Transparency, Sprint Milestone, Course Complete. Shared chrome:
//   • Full-viewport backdrop (navy / black tint + 12px blur)
//   • Centered panel with riseIn entrance (from globals.css)
//   • Themed surface (paper in Editorial, glass in Cinematic)
//   • Escape key closes, backdrop click closes, inner click doesn't
//   • Body scroll locked while open
//
// Intentionally not a generic slot for forms / dialogs the product uses
// elsewhere (ConfirmBlock still handles those) — this is specifically
// the ceremonial-moment surface.
export function Modal({
  open,
  onClose,
  children,
  width = 520,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** id of the element inside children that labels the dialog for a11y. */
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape + lock body scroll while open. Mount side-effects
  // only when actually open so the component can sit unmounted in the
  // tree with zero cost.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the panel on mount for screen readers + keyboard users.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-[100] grid place-items-center"
      onClick={onClose}
      style={{
        background: "rgba(16, 29, 81, 0.45)",
        backdropFilter: "blur(12px)",
        animation: "fadeIn .25s ease",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86vh] max-w-[90vw] overflow-auto outline-none"
        style={{
          width,
          background: "var(--t-paper)",
          border: "1px solid var(--t-rule)",
          borderRadius: "var(--t-radius-lg)",
          color: "var(--t-ink)",
          padding: 36,
          boxShadow: "0 40px 100px rgba(0,0,0,.4)",
          animation: "riseIn .35s cubic-bezier(.2,.8,.3,1)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
