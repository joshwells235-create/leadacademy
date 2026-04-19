"use client";

import { useState } from "react";
import type { ApprovalHandler } from "./types";

/**
 * Shared pill used by `needsApproval` tool renderers. Renders the tool's
 * proposal summary + Apply / Dismiss buttons. Once the learner acts, the
 * buttons disable and the pill shows what was decided. Older messages'
 * pending approvals render as inert.
 */
export function ApprovalPill({
  title,
  body,
  approvalId,
  isLatestMessage,
  onApproval,
  applyLabel = "Apply",
  dismissLabel = "Not now",
}: {
  title: string;
  body: React.ReactNode;
  approvalId: string | undefined;
  isLatestMessage: boolean;
  onApproval: ApprovalHandler;
  applyLabel?: string;
  dismissLabel?: string;
}) {
  const [pending, setPending] = useState(false);

  const handle = async (approved: boolean) => {
    if (!approvalId || pending) return;
    setPending(true);
    try {
      await onApproval(approvalId, approved);
    } catch {
      setPending(false);
    }
  };

  const stale = !isLatestMessage || !approvalId;

  return (
    <div className="mt-1 rounded-lg border border-brand-blue/30 bg-white/80 p-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{title}</p>
        {!stale && (
          <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-medium text-brand-blue">
            waiting on you
          </span>
        )}
      </div>
      <div className="mt-1 text-sm text-brand-navy">{body}</div>
      {stale ? (
        <p className="mt-2 text-xs italic text-neutral-500">
          No longer actionable — start a new conversation to revisit.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handle(true)}
              disabled={pending}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
            >
              {applyLabel}
            </button>
            <button
              type="button"
              onClick={() => handle(false)}
              disabled={pending}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-brand-light disabled:opacity-50"
            >
              {dismissLabel}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            Pick one to keep chatting — nothing saves until you do.
          </p>
        </>
      )}
    </div>
  );
}
