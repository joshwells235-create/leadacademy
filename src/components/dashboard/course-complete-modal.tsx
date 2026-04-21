"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccentWord } from "@/components/design/accent-word";
import { Modal } from "@/components/design/modal";

// Course Complete — the celebration moment when a learner finishes the
// last lesson. 70×70 accent→blue gradient circle with a ◎ glyph,
// pulsePop entrance, serif 38 title with italic accent on the closing
// word, subtitle explaining the debrief draft, two buttons:
// "Debrief with TP →" (primary) and "View certificate" (outline).
//
// The `onDebrief` callback owns the real work — the lesson viewer
// passes a handler that calls `startCourseDebrief(courseId)`. The
// certificate link routes to `/learning/[courseId]/certificate` by
// default; the viewer can override when the course doesn't issue one.
export function CourseCompleteModal({
  open,
  onClose,
  courseTitle,
  courseId,
  lessonCount,
  totalMinutes,
  accentTail,
  onDebrief,
  certificateHref,
}: {
  open: boolean;
  onClose: () => void;
  courseTitle: string;
  courseId: string;
  lessonCount: number;
  totalMinutes: number | null;
  /** The italic-accent closing word. Defaults to the last word of the
   *  course title; pass an override for titles that end awkwardly. */
  accentTail?: string;
  /** Fires when the learner hits "Debrief with TP". The lesson viewer
   *  invokes `startCourseDebrief` here. When the handler isn't
   *  provided, the button routes to `/coach-chat?mode=debrief` as a
   *  graceful fallback. */
  onDebrief?: () => void | Promise<void>;
  certificateHref?: string;
}) {
  const router = useRouter();
  const { head, tail } = splitAccent(courseTitle, accentTail);

  const debriefPath = `/coach-chat?mode=debrief&courseId=${courseId}`;
  const certPath = certificateHref ?? `/learning/${courseId}/certificate`;

  const handleDebrief = async () => {
    if (onDebrief) {
      await onDebrief();
      return;
    }
    onClose();
    router.push(debriefPath);
  };

  return (
    <Modal open={open} onClose={onClose} width={560} labelledBy="course-complete-title">
      <div className="text-center">
        {/* 70×70 radial-gradient circle (accent → blue) with pulsePop. */}
        <div className="relative mb-4 h-[80px]">
          <div
            className="absolute left-1/2 top-0 grid h-[70px] w-[70px] -translate-x-1/2 place-items-center rounded-full text-[32px] text-white"
            style={{
              background: "linear-gradient(135deg, var(--t-accent), var(--t-blue))",
              boxShadow: "0 0 60px var(--t-accent-soft)",
              animation: "pulsePop .6s ease",
            }}
            aria-hidden
          >
            ◎
          </div>
        </div>

        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Course complete
        </p>

        <h2
          id="course-complete-title"
          className="mx-auto max-w-[520px] text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 38,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {head} {tail && <AccentWord>{tail}</AccentWord>}
        </h2>

        <p className="mx-auto mt-4 max-w-[440px] text-[14.5px] leading-[1.6] text-ink-soft">
          {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          {totalMinutes ? `, ${totalMinutes} minutes` : ""}. Your Thought Partner
          drafted a debrief grounded in what you highlighted and the pause moments
          you logged alongside it. Want to walk through what stuck?
        </p>

        <div className="mt-7 flex justify-center gap-2.5">
          <button
            type="button"
            onClick={handleDebrief}
            className="inline-flex items-center rounded-full px-5 py-3 text-[13px] font-medium text-white transition"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 4px 20px var(--t-accent-soft)",
            }}
          >
            Debrief with TP →
          </button>
          <Link
            href={certPath}
            onClick={onClose}
            className="inline-flex items-center rounded-full border px-5 py-3 text-[13px] font-medium text-ink transition hover:opacity-90"
            style={{ borderColor: "var(--t-rule)" }}
          >
            View certificate
          </Link>
        </div>
      </div>
    </Modal>
  );
}

// Split the course title into a head + accent tail. If the caller
// passes `accentTail`, we strip it from the end of the title and use
// the override. Otherwise we isolate the last word naturally — reads
// like "Coaching conversations that <land.>" rather than splitting
// mid-phrase. Punctuation on the tail is preserved.
function splitAccent(
  title: string,
  override?: string,
): { head: string; tail: string } {
  if (override) {
    const headSource = title.replace(new RegExp(`\\s*${escapeRegex(override)}\\.?$`), "");
    return { head: headSource, tail: override };
  }
  const match = title.match(/^(.*?)\s*([A-Za-z'-]+[.?!]?)$/);
  if (!match) return { head: title, tail: "" };
  return { head: match[1] ?? "", tail: match[2] ?? "" };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
