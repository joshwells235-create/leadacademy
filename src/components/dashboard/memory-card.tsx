import Link from "next/link";
import { Panel } from "@/components/design/panel";
import { MonoLabel } from "@/components/design/mono-label";

// Three lines of "what your thought partner remembers about you." The
// privacy gesture lives here: the learner can always see — and edit —
// the facts the TP is acting on. Pink bullet dots keep the AI's voice
// signature visible without a heavy frame.
//
// Facts are stored in `learner_memory` and surfaced to every chat turn
// via LearnerContext.memory. Here we pull the highest-confidence three
// and link to /memory for the full editable list.
export function MemoryCard({
  facts,
}: {
  facts: Array<{ id: string; content: string }>;
}) {
  return (
    <Panel>
      <MonoLabel>What your thought partner remembers</MonoLabel>

      {facts.length === 0 ? (
        <p className="mt-3 text-[12.5px] leading-[1.55] text-ink-soft">
          Nothing saved yet. As you talk with your thought partner, it'll quietly
          save the things that help it know you — preferences, patterns, what
          you're working on. You can edit or delete anything it saves.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {facts.slice(0, 3).map((f) => (
            <li
              key={f.id}
              className="flex items-start gap-2 text-[12.5px] leading-[1.5] text-ink-soft"
            >
              <span aria-hidden className="shrink-0 text-accent">
                ·
              </span>
              <span>{f.content}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/memory"
        className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft hover:text-accent"
      >
        See everything →
      </Link>
    </Panel>
  );
}
