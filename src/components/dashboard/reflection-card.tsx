import Link from "next/link";
import { Panel } from "@/components/design/panel";
import { MonoLabel } from "@/components/design/mono-label";

// A tiny, typographic window onto the learner's own voice. We pull the
// most recent reflection and render a snippet in Instrument Serif
// italic — the learner's words, framed the way a journal would. On
// click, routes to /reflections so they can open the full entry.
//
// Deliberately sparse: no CTA, no secondary actions. The point is to
// show up and remind — the learner is writing, they've written before,
// here's what it sounded like.
export function ReflectionCard({
  reflection,
}: {
  reflection: {
    id: string;
    content: string;
    created_at: string;
  } | null;
}) {
  if (!reflection) {
    return (
      <Panel>
        <MonoLabel>Reflections</MonoLabel>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Nothing here yet. When you write a reflection, the most recent one will
          surface here as a quiet reminder of your own voice.
        </p>
        <Link
          href="/reflections"
          className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-accent hover:opacity-80"
        >
          Start writing →
        </Link>
      </Panel>
    );
  }

  // Trim to ~240 chars so the card stays a single panel's rhythm.
  // A longer entry truncates with the learner's own ellipsis, not ours.
  const snippet =
    reflection.content.length > 240
      ? `${reflection.content.slice(0, 240).trimEnd()}…`
      : reflection.content;

  const label = labelFor(reflection.created_at);

  return (
    <Link
      href={`/reflections#${reflection.id}`}
      className="block transition hover:opacity-95"
    >
      <Panel>
        <MonoLabel>{label}</MonoLabel>
        <blockquote
          className="mt-3 italic leading-[1.4] text-ink"
          style={{
            fontFamily: "var(--font-italic)",
            fontSize: 17,
          }}
        >
          &ldquo;{snippet}&rdquo;
        </blockquote>
      </Panel>
    </Link>
  );
}

// The eyebrow label leans into natural phrasing the way a journal
// does — "Sunday's page" is more human than "Most recent reflection."
// Falls back to the actual weekday when the most recent entry wasn't
// written on a Sunday.
function labelFor(iso: string): string {
  const when = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - when.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 1) return "Today's page";
  if (diffDays <= 3) return "Your recent page";
  const weekday = when.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}'s page`;
}
