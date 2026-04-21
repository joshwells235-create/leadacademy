"use client";

import type { ReactNode } from "react";

/**
 * In-UI confirmation block — drop-in replacement for browser `confirm()`
 * for destructive or high-impact admin actions. Inline rather than modal
 * so the admin can see the row/item they're confirming against. Uses
 * tone tokens (amber for cautionary, danger red for destructive, emerald
 * for restorative) to match surrounding iconography. Destructive is NOT
 * pink — pink is reserved exclusively for the Thought Partner voice.
 */
type Tone = "destructive" | "caution" | "restorative";

export function ConfirmBlock({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  pending = false,
  tone = "caution",
  error,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  tone?: Tone;
  error?: string | null;
}) {
  const toneClasses = {
    destructive: {
      container: "border-danger/30 bg-danger-light/60",
      title: "text-brand-navy",
      confirmBtn: "bg-danger text-white hover:opacity-90",
    },
    caution: {
      container: "border-amber-300 bg-amber-50",
      title: "text-amber-900",
      confirmBtn: "bg-amber-600 text-white hover:bg-amber-700",
    },
    restorative: {
      container: "border-emerald-300 bg-emerald-50",
      title: "text-emerald-900",
      confirmBtn: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
  }[tone];

  return (
    <div
      role="alertdialog"
      aria-label={title}
      className={`rounded-md border p-3 text-sm ${toneClasses.container}`}
    >
      <p className={`font-semibold ${toneClasses.title}`}>{title}</p>
      {children && <div className="mt-1 text-xs text-neutral-700">{children}</div>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${toneClasses.confirmBtn}`}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-brand-light disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
