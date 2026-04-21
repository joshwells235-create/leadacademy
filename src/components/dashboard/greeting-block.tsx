import { AccentWord } from "@/components/design/accent-word";

// The dashboard opens with a greeting, a mono pathway strip above it,
// and a single line of editorial framing. Two sizes — Overview (40px)
// and Focus (54px). Focus isn't a typographic whim: Focus mode is the
// "less noise, more ritual" reading of the dashboard, and the bigger
// hero is how the type anchors that intention.
//
// The "accent phrase" at the end of the hero is intentionally variable
// — the line changes based on what's alive for the learner right now
// (sprint landing, sprint ending soon, assessments fresh, etc.). Keep
// the accent short — three to six words read like a breath.
export function GreetingBlock({
  firstName,
  programWeek,
  programTotal,
  sprintNumber,
  sprintDay,
  accentPhrase,
  tail,
  density,
}: {
  firstName: string;
  programWeek: number | null;
  programTotal: number | null;
  sprintNumber: number | null;
  sprintDay: number | null;
  /** The italic-accent phrase in the middle of the hero, e.g.
   *  "The sprint is landing —". Leave blank to suppress the accent. */
  accentPhrase?: string;
  /** The sentence tail after the accent phrase, e.g.
   *  "let's look at what it's telling us." */
  tail?: string;
  density: "focus" | "overview";
}) {
  const pathway = buildPathway({ programWeek, programTotal, sprintNumber, sprintDay });
  const isFocus = density === "focus";

  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className={isFocus ? "mb-12" : "mb-7"}>
      {pathway && (
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {pathway}
        </p>
      )}
      <h1
        className="max-w-[1000px] leading-[1.08] tracking-[-0.01em] text-ink"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: isFocus ? "clamp(36px, 5.2vw, 54px)" : "clamp(28px, 3.8vw, 40px)",
        }}
      >
        {salutation}, {firstName}.{" "}
        {accentPhrase ? (
          <>
            <AccentWord>{accentPhrase}</AccentWord> {tail ?? ""}
          </>
        ) : (
          (tail ?? "")
        )}
      </h1>
    </div>
  );
}

// Build the "WEEK 14 OF 36 · SPRINT 02 · DAY 12" pathway strip, dropping
// pieces that aren't available yet so a first-time learner doesn't see
// "SPRINT 00 · DAY NaN". Returns null if there's nothing meaningful.
function buildPathway({
  programWeek,
  programTotal,
  sprintNumber,
  sprintDay,
}: {
  programWeek: number | null;
  programTotal: number | null;
  sprintNumber: number | null;
  sprintDay: number | null;
}): string | null {
  const parts: string[] = [];
  if (programWeek !== null && programTotal !== null) {
    parts.push(`Week ${programWeek} of ${programTotal}`);
  } else if (programWeek !== null) {
    parts.push(`Week ${programWeek}`);
  }
  if (sprintNumber !== null) {
    parts.push(`Sprint ${String(sprintNumber).padStart(2, "0")}`);
  }
  if (sprintDay !== null) {
    parts.push(`Day ${sprintDay}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
