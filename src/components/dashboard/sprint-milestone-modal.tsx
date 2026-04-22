"use client";

import { useRouter } from "next/navigation";
import { AccentWord } from "@/components/design/accent-word";
import { Modal } from "@/components/design/modal";

// Sprint Milestone — the behavioral-shift celebration. Two states:
//
//   • Empty (actionCount === 0): no milestone to mark yet. Honest
//     reframe that points back at the log-a-moment affordance. The
//     previous build rendered "You've shown up 0 times" with the big
//     celebration chrome, which read as hollow — a milestone needs
//     something to mark. This branch ships an empty-state instead so
//     the button can stay live without lying about progress.
//
//   • Non-empty: the Fraunces-56 celebration with italic-accent verb
//     derived from the sprint's practice, and a subtitle that frames
//     the behavioral shift ("a week ago this wasn't a practice, now
//     you've done it N times").
//
// The goal title is embedded verbatim — no lowercasing — because it
// often contains proper nouns (product names, team names, acronyms
// like "BD" or "HubSpot") that read wrong when flattened.
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

  // Empty state — render a different shape rather than a fake
  // celebration. Still themed, still resolves into the same two follow
  // up actions, just framed honestly.
  if (actionCount === 0) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        width={560}
        labelledBy="milestone-title"
      >
        <div className="text-center">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Milestone · nothing to mark yet
          </p>
          <h2
            id="milestone-title"
            className="text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 40,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            The first rep is the milestone.
          </h2>
          <p className="mx-auto mt-5 max-w-[440px] text-[15px] leading-[1.6] text-ink-soft">
            You haven't logged a moment on this sprint yet.{" "}
            {day <= 2
              ? "Plenty of time — the sprint just started."
              : `${Math.max(0, totalDays - day)} days left.`}{" "}
            The first one you log is what turns the practice into a habit.
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
              Log the first one →
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
              Think it through with TP
            </button>
          </div>
        </div>
      </Modal>
    );
  }

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
          You've <AccentWord>{actionWord}</AccentWord> {actionCount}{" "}
          {actionCount === 1 ? "time" : "times"}.
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
// Broader matcher than before so practices like "Log the contact in
// HubSpot before moving on" map to "logged" instead of the lazy
// "shown up" fallback.
function deriveActionWord(practice: string): string {
  const p = practice.toLowerCase();
  if (/pause|stop|wait|hold/.test(p)) return "paused";
  if (/ask|question/.test(p)) return "asked";
  if (/let go|release|hand off|delegate/.test(p)) return "let go";
  if (/notice|observ/.test(p)) return "noticed";
  if (/listen/.test(p)) return "listened";
  if (/log|record|capture/.test(p)) return "logged";
  if (/follow up|follow-up|reach out/.test(p)) return "followed up";
  if (/write|draft/.test(p)) return "written";
  if (/schedule|book/.test(p)) return "scheduled";
  if (/share|send/.test(p)) return "sent";
  if (/say|speak|name/.test(p)) return "named";
  if (/reflect|think/.test(p)) return "reflected";
  return "practiced";
}

// Short subtitle. Frames the behavior change — "a week ago this wasn't
// a practice. Now you've done it N times." Preserves the goal title's
// casing so proper nouns (BD, HubSpot, product names, team names)
// don't get flattened. Adjusts the time-ago phrase for the earliest
// days of a sprint so "a week ago" doesn't claim to reach further
// back than the sprint's been alive.
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
  const timeAgo =
    day < 3
      ? "A few days ago"
      : day < 10
        ? "A week ago"
        : `${Math.round(day / 7)} weeks ago`;
  const times = actionCount === 1 ? "once" : `${actionCount} times`;
  const remaining = Math.max(0, totalDays - day);
  const remainingLine =
    remaining > 0 ? ` ${remaining} ${remaining === 1 ? "day" : "days"} left in this sprint.` : "";
  return `${timeAgo}, this wasn't a practice. Now you've done it ${times} — against "${goalTitle}".${remainingLine}`;
}
