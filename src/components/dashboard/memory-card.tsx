import Link from "next/link";
import { Panel } from "@/components/design/panel";
import { MonoLabel } from "@/components/design/mono-label";

type ContextSummary = {
  goalsActive: number;
  assessmentsIntegrated: number;
  reflectionsCount: number;
  conversationsCount: number;
  hasActiveSprint: boolean;
  profileComplete: boolean;
};

// "What your thought partner remembers." Two-state design:
//
//   • When `learner_memory` has distilled facts → the intended state:
//     three top facts, pink-dot bullets, link out to /memory.
//
//   • When the table is empty but the learner has real activity — goals,
//     assessments, reflections, conversations, an active sprint — render
//     a truthful inventory of what's in the TP's per-turn context
//     instead of the misleading "Nothing saved yet" we used to show.
//     Memory-fact distillation runs after a conversation has been idle
//     ≥2h and a new one starts; until that happens, the TP still
//     "remembers" everything else on every turn. The card now reflects
//     that honestly.
//
//   • When the table is empty AND there's no activity → the original
//     first-run copy, unchanged.
export function MemoryCard({
  facts,
  context,
}: {
  facts: Array<{ id: string; content: string }>;
  context: ContextSummary;
}) {
  if (facts.length > 0) {
    return (
      <Panel>
        <MonoLabel>What your thought partner remembers</MonoLabel>
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
        <Link
          href="/memory"
          className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft hover:text-accent"
        >
          See everything →
        </Link>
      </Panel>
    );
  }

  // Derive the "what's in context" summary line. Only list items that
  // actually exist so the learner sees specifics, not placeholders.
  const items = buildContextItems(context);
  const hasRealActivity = items.length > 0;

  return (
    <Panel>
      <MonoLabel>What your thought partner remembers</MonoLabel>

      {hasRealActivity ? (
        <>
          <p className="mt-3 text-[12.5px] leading-[1.55] text-ink-soft">
            Already in the room:
          </p>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-[12.5px] leading-[1.5] text-ink-soft"
              >
                <span aria-hidden className="shrink-0 text-accent">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-[1.55] text-ink-faint">
            Durable patterns get distilled into editable facts once a
            conversation settles (usually after you come back to start a
            fresh one). They'll show up here.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[12.5px] leading-[1.55] text-ink-soft">
          Nothing saved yet. As you talk with your thought partner, it'll
          quietly save the things that help it know you — preferences,
          patterns, what you're working on. You can edit or delete anything
          it saves.
        </p>
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

// Build the bulleted summary list. Each line describes one piece of
// context the thought partner has, in plain language. Omits items that
// don't exist so the list never inflates.
function buildContextItems(context: ContextSummary): string[] {
  const out: string[] = [];
  if (context.profileComplete) {
    out.push("Your profile — role, team, tenure, context you shared at intake.");
  }
  if (context.goalsActive > 0) {
    out.push(
      `Your ${context.goalsActive === 1 ? "goal" : `${context.goalsActive} goals`} across the three lenses.`,
    );
  }
  if (context.hasActiveSprint) {
    out.push("Your active sprint — practice, day count, action log.");
  }
  if (context.assessmentsIntegrated > 0) {
    out.push(
      `Your ${context.assessmentsIntegrated === 1 ? "assessment" : `${context.assessmentsIntegrated} assessments`} — themes and tendencies.`,
    );
  }
  if (context.reflectionsCount > 0) {
    out.push(
      `Your ${context.reflectionsCount === 1 ? "reflection" : `${context.reflectionsCount} reflections`}.`,
    );
  }
  if (context.conversationsCount > 0) {
    out.push(
      `Your ${context.conversationsCount === 1 ? "conversation" : `${context.conversationsCount} conversations`} with the TP.`,
    );
  }
  return out;
}
