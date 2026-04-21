"use client";

import { useRouter } from "next/navigation";
import { AccentWord } from "@/components/design/accent-word";
import { Modal } from "@/components/design/modal";

// Sprint Milestone — the halfway celebration. The learner marks a real
// behavioral shift: "You've stopped seven times" — two weeks ago this
// wasn't a thing you did. Framed in big Fraunces, accent italic on the
// verb, with two follow-ups: keep going, or reflect with the TP.
//
// The "milestone framing" line is derived from the active sprint state
// (action count, phase, goal). Keeps the modal deterministic —
// same sprint state gives the same celebration text, no LLM call
// required for the feel-good moment.
export function SprintMilestoneModal({
  open,
  onClose,
  sprintNumber,
  actionCount,
  practice,
  goalTitle,
  day,
  totalDays,
}: {
  open: boolean;
  onClose: () => void;
  sprintNumber: number | null;
  actionCount: number;
  practice: string;
  goalTitle: string;
  day: number;
  totalDays: number;
}) {
  const router = useRouter();
  const label = deriveLabel(day, totalDays);
  const actionWord = deriveActionWord(practice);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      labelledBy="milestone-title"
    >
      <div className="text-center">
        <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Milestone ·{" "}
          {label}
          {sprintNumber !== null &&
            ` through Sprint ${String(sprintNumber).padStart(2, "0")}`}
        </p>
        <h2
          id="milestone-title"
          className="text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 56,
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          You've <AccentWord>{actionWord}</AccentWord> {actionCount} times.
        </h2>
        <p className="mx-auto mt-5 max-w-[440px] text-[15px] leading-[1.6] text-ink-soft">
          {frameShift({ actionCount, goalTitle, day, totalDays })}
        </p>
        <div className="mt-7 flex justify-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-full px-5 py-3 text-[13px] font-medium text-white transition"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 4px 20px var(--t-accent-soft)",
            }}
          >
            Keep going →
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/coach-chat?mode=reflection");
            }}
            className="inline-flex items-center rounded-full border px-5 py-3 text-[13px] font-medium text-ink transition hover:opacity-90"
            style={{ borderColor: "var(--t-rule)" }}
          >
            Reflect with TP
          </button>
        </div>
      </div>
    </Modal>
  );
}

// "Halfway through" / "Two-thirds through" / "Near the end" — phase
// label that matches the day/total ratio. Keep these short; the line
// reads as a typographic eyebrow, not prose.
function deriveLabel(day: number, total: number): string {
  if (total <= 0) return "Midway";
  const pct = day / total;
  if (pct < 0.4) return "Early in";
  if (pct < 0.6) return "Halfway through";
  if (pct < 0.85) return "Two-thirds through";
  return "Closing in on the end of";
}

// Pull the verb from the sprint's practice sentence so the celebration
// mirrors the learner's own behavior ("stopped" when the practice is
// "Pause before I rescue"; "asked" when it's "Ask one question back").
// Conservative fallback to "shown up" so the headline is always
// grammatical.
function deriveActionWord(practice: string): string {
  const p = practice.toLowerCase();
  if (/pause|stop|wait|hold/.test(p)) return "stopped";
  if (/ask|question/.test(p)) return "asked";
  if (/let go|release/.test(p)) return "let go";
  if (/notice|observ/.test(p)) return "noticed";
  if (/listen/.test(p)) return "listened";
  return "shown up";
}

// Short subtitle. Frames the behavior change — "two weeks ago, pausing
// before answering wasn't a thing you did. Now it's a thing you've
// done seven times." Tailors from sprint state but stays generic
// enough to read well for any goal.
function frameShift({
  actionCount,
  goalTitle,
  day,
  totalDays,
}: {
  actionCount: number;
  goalTitle: string;
  day: number;
  totalDays: number;
}): string {
  const weeksAgo = Math.max(1, Math.round(day / 7));
  const weeks = weeksAgo === 1 ? "a week ago" : `${weeksAgo} weeks ago`;
  const remainingDays = Math.max(0, totalDays - day);
  const remainingLine =
    remainingDays > 0 ? ` ${remainingDays} days left in this sprint.` : "";
  return `${weeks}, this wasn't a practice. Now it's something you've done ${actionCount} times — against the goal to ${goalTitle.toLowerCase()}.${remainingLine}`;
}
