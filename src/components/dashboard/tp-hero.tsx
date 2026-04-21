"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AccentWord } from "@/components/design/accent-word";
import { MonoLabel } from "@/components/design/mono-label";
import { Panel } from "@/components/design/panel";
import { TPOrb } from "@/components/design/tp-orb";
import { dismissNudge } from "@/lib/nudges/actions";
import {
  TPTransparencyModal,
  type TransparencySource,
} from "./tp-transparency-modal";

// The TP hero is the always-prominent moment on the dashboard — the
// learner's thought partner showing up with something specific. It
// takes three shapes:
//
//  1. `nudge` — a pending coach_nudge with an AI-generated opener.
//     The strongest signal the product has. Renders title / body /
//     "Continue the thread" button + grounded-in strip + dismiss.
//  2. `resume` — no nudge, but a recent conversation. Renders a
//     "pick up where we left off" framing so the canvas is never
//     blank for a returning learner.
//  3. `welcome` — first-time learners or folks with no activity.
//     Plain orb + short invitation + "Start a conversation" CTA.
//
// The `onOpenTransparency` prop fires a "how it knew" modal in Phase 4.
// For now it's optional; the Phase 3 build can ship without it.
export type TPHeroShape =
  | {
      kind: "nudge";
      id: string;
      title: string;
      body: string;
      href: string;
      groundedIn?: string[];
    }
  | {
      kind: "resume";
      conversationId: string;
      lastMessageAt: string | null;
      title: string | null;
    }
  | {
      kind: "welcome";
      firstName: string;
    };

export function TPHero({
  shape,
  density,
  transparencySources,
}: {
  shape: TPHeroShape;
  density: "focus" | "overview";
  /** The context sources the "See how it knew" modal lists. When
   *  omitted, the button is suppressed — better to hide the affordance
   *  than render a promise ("I'll show you") with nothing behind it. */
  transparencySources?: TransparencySource[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isFocus = density === "focus";
  const [transparencyOpen, setTransparencyOpen] = useState(false);

  const handleDismiss = (nudgeId: string) => {
    start(async () => {
      await dismissNudge(nudgeId);
      router.refresh();
    });
  };

  // Meta line just under the orb — "Your Thought Partner · <context>".
  // Switches copy depending on the shape.
  const metaTail =
    shape.kind === "nudge"
      ? shape.title.toLowerCase()
      : shape.kind === "resume"
        ? pickingUpLabel(shape.lastMessageAt)
        : "ready when you are";

  return (
    <Panel
      glow
      style={{
        padding: isFocus ? 44 : 36,
        position: "relative",
      }}
    >
      {/* Meta row — orb + mono "Your Thought Partner · picked up …"
          + right-aligned "See how it knew" (Phase 4 modal hook). */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <TPOrb size={36} live />
          <div className="min-w-0">
            <MonoLabel>Your Thought Partner · {metaTail}</MonoLabel>
            {shape.kind === "nudge" && shape.groundedIn && shape.groundedIn.length > 0 && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                Grounded in · {shape.groundedIn.slice(0, 5).join(" · ")}
              </p>
            )}
          </div>
        </div>
        {transparencySources && transparencySources.length > 0 && (
          <button
            type="button"
            onClick={() => setTransparencyOpen(true)}
            className="shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft transition hover:text-ink"
            style={{ borderColor: "var(--t-rule)" }}
          >
            ◉ See how it knew
          </button>
        )}
      </div>

      {/* Hero body — differs by shape. */}
      {shape.kind === "nudge" ? (
        <>
          <HeroSerif isFocus={isFocus}>{shape.title}</HeroSerif>
          <p className="mb-5 max-w-[760px] text-[14.5px] leading-[1.65] text-ink-soft">
            {shape.body}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={shape.href}
              className="inline-flex items-center rounded-full px-5 py-3 text-[13.5px] font-medium text-white transition hover:opacity-95"
              style={{
                background: "var(--t-accent)",
                boxShadow: "0 4px 20px var(--t-accent-soft)",
              }}
            >
              Continue the thread →
            </Link>
            <Link
              href="/coach-chat/new"
              className="inline-flex items-center rounded-full border px-5 py-3 text-[13.5px] font-medium text-ink transition hover:opacity-90"
              style={{ borderColor: "var(--t-rule)" }}
            >
              Start fresh
            </Link>
            <button
              type="button"
              onClick={() => handleDismiss(shape.id)}
              disabled={pending}
              className="text-[13px] text-ink-faint transition hover:text-ink-soft disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </>
      ) : shape.kind === "resume" ? (
        <>
          <HeroSerif isFocus={isFocus}>
            Pick up where we <AccentWord>left off.</AccentWord>
          </HeroSerif>
          <p className="mb-5 max-w-[760px] text-[14.5px] leading-[1.65] text-ink-soft">
            {shape.title
              ? `We were talking about ${shape.title.toLowerCase()}. Open the thread or start fresh.`
              : "Your last thread is still open. Open it, or start fresh — whatever feels right."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/coach-chat?c=${shape.conversationId}`}
              className="inline-flex items-center rounded-full px-5 py-3 text-[13.5px] font-medium text-white transition hover:opacity-95"
              style={{
                background: "var(--t-accent)",
                boxShadow: "0 4px 20px var(--t-accent-soft)",
              }}
            >
              Continue the thread →
            </Link>
            <Link
              href="/coach-chat/new"
              className="inline-flex items-center rounded-full border px-5 py-3 text-[13.5px] font-medium text-ink transition hover:opacity-90"
              style={{ borderColor: "var(--t-rule)" }}
            >
              Start fresh
            </Link>
          </div>
        </>
      ) : (
        <>
          <HeroSerif isFocus={isFocus}>
            Welcome, {shape.firstName}. <AccentWord>Let's get started.</AccentWord>
          </HeroSerif>
          <p className="mb-5 max-w-[760px] text-[14.5px] leading-[1.65] text-ink-soft">
            Your thought partner is ready when you are — tell it what you're working
            on as a leader and it'll start from there.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/coach-chat"
              className="inline-flex items-center rounded-full px-5 py-3 text-[13.5px] font-medium text-white transition hover:opacity-95"
              style={{
                background: "var(--t-accent)",
                boxShadow: "0 4px 20px var(--t-accent-soft)",
              }}
            >
              Start a conversation →
            </Link>
          </div>
        </>
      )}

      {transparencySources && transparencySources.length > 0 && (
        <TPTransparencyModal
          open={transparencyOpen}
          onClose={() => setTransparencyOpen(false)}
          sources={transparencySources}
        />
      )}
    </Panel>
  );
}

function HeroSerif({
  children,
  isFocus,
}: {
  children: React.ReactNode;
  isFocus: boolean;
}) {
  return (
    <p
      className="mb-4 leading-[1.25] text-ink"
      style={{
        fontFamily: "var(--font-serif)",
        fontWeight: 400,
        fontSize: isFocus ? 36 : 30,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </p>
  );
}

// "Picked up before Thursday's 1:1" would be ideal, but we don't have
// a signal for "what the learner is about to do" at this layer — fall
// back to a humane "last talked N days ago" so the meta line feels
// specific without making claims we can't back up.
function pickingUpLabel(iso: string | null): string {
  if (!iso) return "picking up where we left off";
  const when = new Date(iso);
  const days = Math.floor(
    (Date.now() - when.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "picking up from earlier today";
  if (days === 1) return "picking up from yesterday";
  if (days < 7) return `picking up from ${days} days ago`;
  const weekday = when.toLocaleDateString("en-US", { weekday: "long" });
  return `picking up from ${weekday}`;
}
