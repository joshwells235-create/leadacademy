"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccentWord } from "@/components/design/accent-word";
import { Modal } from "@/components/design/modal";
import { createActionLog, type CreateActionLogState } from "@/lib/goals/actions";

// Log a moment — the signature 2-step flow for capturing a sprint
// action. Step 1 is a serif-textarea scratchpad with four tag chips;
// step 2 is a celebration ("Logged. That's eight now.") that confirms
// the insert and frames pace.
//
// Writes through the existing `createActionLog` server action so sprint
// stamping, validation, and revalidation all stay in one place. The
// tag chip is appended to the description so it survives the existing
// action-log shape without a schema change.
//
// The celebration number comes from the count of actions in the active
// sprint *after* the new log. The parent passes `sprintActionCount`
// from the dashboard's assembled data; we increment locally for the
// celebration frame since the server has already revalidated.
type Step = "capture" | "celebrate";

// Universal tags — they need to work for every kind of sprint (behavioral
// leadership practices AND systems/habit practices). Earlier set
// (Pause/Let go/Noticed/Asked back) assumed a delegation-style sprint and
// didn't fit practices like "open HubSpot after every BD call." These four
// cover both shapes: did the practice, started but didn't finish, noticed
// and skipped, or learned something.
const TAGS = ["Did it", "Almost", "Skipped", "Learned"] as const;
type Tag = (typeof TAGS)[number];

export function LogMomentModal({
  open,
  onClose,
  goalId,
  sprintNumber,
  sprintPractice,
  sprintActionCount,
  sprintActionGoal,
  sprintDay,
  sprintTotalDays,
}: {
  open: boolean;
  onClose: () => void;
  goalId: string | null;
  sprintNumber: number | null;
  sprintPractice: string | null;
  sprintActionCount: number;
  sprintActionGoal: number;
  sprintDay: number;
  sprintTotalDays: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("capture");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState<Tag>("Did it");

  // Reset state whenever the modal opens so a second use of the same
  // session starts clean.
  useEffect(() => {
    if (open) {
      setStep("capture");
      setDescription("");
      setTag("Did it");
    }
  }, [open]);

  const initialState: CreateActionLogState = { status: "idle" };
  const [state, formAction, pending] = useActionState(createActionLog, initialState);

  // Advance to celebration on success; refresh the dashboard behind
  // the modal so the heatmap + stats update in place when closed.
  useEffect(() => {
    if (state.status === "success") {
      setStep("celebrate");
      router.refresh();
    }
  }, [state.status, router]);

  // Post-log count for the celebration line. Use the known pre-log
  // action_count + 1 since the revalidate races the celebration render.
  const celebrationCount = sprintActionCount + 1;
  const midpoint =
    sprintActionGoal > 0 && celebrationCount >= sprintActionGoal / 2;

  return (
    <Modal open={open} onClose={onClose} labelledBy="log-moment-title">
      {step === "capture" ? (
        <form action={formAction} className="space-y-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Log a moment
            {sprintNumber !== null &&
              ` · Sprint ${String(sprintNumber).padStart(2, "0")}`}
          </p>
          <h2
            id="log-moment-title"
            className="mt-2.5 leading-[1.2] text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            What just happened?
          </h2>

          {sprintPractice && (
            <p
              className="mt-3 italic text-ink-soft"
              style={{
                fontFamily: "var(--font-italic)",
                fontSize: 13,
                borderLeft: "2px solid var(--t-accent)",
                paddingLeft: 10,
              }}
            >
              Your practice: {sprintPractice}
            </p>
          )}

          <label htmlFor="log-moment-description" className="sr-only">
            What just happened
          </label>
          <textarea
            id="log-moment-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
            placeholder="What you did, what you noticed, what tripped you up…"
            className="mt-5 w-full resize-none rounded-[10px] p-4 text-ink outline-none"
            style={{
              fontFamily: "var(--font-italic)",
              fontSize: 17,
              lineHeight: 1.5,
              background: "transparent",
              border: "1px solid var(--t-rule)",
              minHeight: 120,
            }}
          />

          {/* Tag chips — one-tap category for the log. Persisted into
              the description so the existing action_logs shape holds. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {TAGS.map((tg) => {
              const selected = tg === tag;
              return (
                <button
                  key={tg}
                  type="button"
                  onClick={() => setTag(tg)}
                  className="rounded-full px-3 py-1.5 text-[12px] transition"
                  style={{
                    background: selected ? "var(--t-ink)" : "transparent",
                    color: selected ? "#fff" : "var(--t-ink-soft)",
                    border: `1px solid ${selected ? "var(--t-ink)" : "var(--t-rule)"}`,
                  }}
                >
                  {tg}
                </button>
              );
            })}
          </div>

          {/* Hidden inputs so the server action has sprint + tag context.
              The server action accepts goalId + description; we prepend
              the tag to the description so it survives the existing
              insert shape without a schema change. */}
          <input type="hidden" name="goalId" value={goalId ?? ""} />
          {/* The server action reads `description` directly — we rebuild
              the value including tag when the user submits. */}
          <TagPrefixedDescription tag={tag} description={description} />

          {state.status === "error" && (
            <p
              className="mt-4 rounded-md p-3 text-sm"
              style={{
                color: "var(--t-accent)",
                background: "var(--t-accent-soft)",
                border: "1px solid var(--t-rule)",
              }}
            >
              {state.message}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] text-ink-soft transition hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || pending}
              className="inline-flex items-center rounded-full px-5 py-3 text-[13px] font-medium text-white transition disabled:cursor-not-allowed"
              style={{
                background: description.trim() ? "var(--t-accent)" : "var(--t-rule)",
                opacity: description.trim() ? 1 : 0.5,
              }}
            >
              {pending ? "Logging…" : "Log it →"}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center">
          {/* 72×72 accent circle with check, pulsePop on mount. */}
          <div
            className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full text-[32px] text-white"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 0 60px var(--t-accent-soft)",
              animation: "pulsePop .6s ease",
            }}
            aria-hidden
          >
            ✓
          </div>
          <h2
            id="log-moment-title"
            className="mt-6 text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            Logged. That's <AccentWord>{ordinal(celebrationCount)}</AccentWord> now.
          </h2>
          <p className="mx-auto mt-3 max-w-[380px] text-[14px] leading-[1.55] text-ink-soft">
            {celebrationLine(
              celebrationCount,
              sprintActionGoal,
              sprintDay,
              sprintTotalDays,
              midpoint,
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex items-center rounded-full px-5 py-3 text-[13px] font-medium text-white transition"
            style={{ background: "var(--t-accent)" }}
          >
            Back to today
          </button>
        </div>
      )}
    </Modal>
  );
}

// Renders a hidden input that re-submits the tagged description so the
// server action reads the tagged version. Kept out of the controlled
// <textarea> so the writing surface stays clean for the learner.
function TagPrefixedDescription({
  tag,
  description,
}: {
  tag: Tag;
  description: string;
}) {
  const trimmed = description.trim();
  const value = trimmed ? `[${tag}] ${trimmed}` : trimmed;
  // Override the form's previous description field by name. React
  // renders the latest hidden input after the textarea in the form, so
  // FormData will pick up this value.
  return <input type="hidden" name="description" value={value} />;
}

// Cardinal → Fraunces-rendered ordinal word, because "eight" reads
// better than "8th" in the celebration line. Falls back to numerals
// after twelve where the word length starts to fight the serif.
function ordinal(n: number): string {
  const words = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eight",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
  ];
  // n is 1-indexed count of actions; ordinal index is n - 1.
  return n >= 1 && n <= 12 ? words[n - 1] : `#${n}`;
}

// The subtitle under the celebration headline. Short, specific, rooted
// in where the learner actually is in the sprint. Three beats: "what
// you just did" → "pace read" → "what's next."
function celebrationLine(
  count: number,
  goal: number,
  day: number,
  total: number,
  midpoint: boolean,
): string {
  if (goal <= 0 || total <= 0)
    return "Your thought partner will fold this into the next thread.";
  if (midpoint) {
    return `You're past the midpoint of this sprint (${count}/${goal}) and ahead of pace. Your thought partner will fold this into the next thread.`;
  }
  const pct = (day / total) * 100;
  if (pct < 50) {
    return `Early days (${day}/${total}). Keep going — your thought partner will remember this one.`;
  }
  return `${count}/${goal} moments logged. Your thought partner will fold this into the next thread.`;
}
