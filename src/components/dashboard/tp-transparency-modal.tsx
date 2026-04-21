"use client";

import { Modal } from "@/components/design/modal";
import { TPOrb } from "@/components/design/tp-orb";

// "How it knew" — the TP's transparency gesture. Opens from the TP
// hero's ◉ See how it knew button. Lists the context sources the
// Thought Partner is reading from on this turn, with a short human
// description of each. Footer italic reminds the learner what the TP
// doesn't see and where to edit its memory.
//
// Takes a `sources` prop so the list reflects the actual thread-level
// grounding (sprint actions, last reflection, last recap, etc.). Phase
// 7 can wire this dynamically off the conversation's `context_ref`.
export type TransparencySource = {
  title: string;
  description: string;
};

export function TPTransparencyModal({
  open,
  onClose,
  sources,
}: {
  open: boolean;
  onClose: () => void;
  sources: TransparencySource[];
}) {
  return (
    <Modal open={open} onClose={onClose} width={560} labelledBy="tp-transparency-title">
      <div className="mb-6 flex items-center gap-3">
        <TPOrb size={36} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            How your TP knew
          </p>
          <h2
            id="tp-transparency-title"
            className="text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 400,
              lineHeight: 1.2,
            }}
          >
            What this thread is reading from.
          </h2>
        </div>
      </div>

      <ul className="space-y-4">
        {sources.map((s, i) => (
          <li
            key={`${s.title}-${i}`}
            className="flex gap-3.5 pb-4"
            style={{
              borderBottom:
                i < sources.length - 1 ? "1px solid var(--t-rule)" : "none",
            }}
          >
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "var(--t-accent)" }}
            />
            <div>
              <p className="text-[14px] font-medium text-ink">{s.title}</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">
                {s.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p
        className="mt-5 italic text-ink-faint"
        style={{ fontSize: 12.5, lineHeight: 1.55 }}
      >
        The Thought Partner doesn't read your messages with other people, or
        anything you haven't chosen to share. Edit what it remembers in{" "}
        <a
          href="/memory"
          className="underline decoration-dotted underline-offset-2 hover:text-ink-soft"
        >
          /memory
        </a>
        .
      </p>

      <div className="mt-6 text-right">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-full border px-4 py-2 text-[12px] text-ink transition hover:opacity-90"
          style={{ borderColor: "var(--t-rule)" }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
