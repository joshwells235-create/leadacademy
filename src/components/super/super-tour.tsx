"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTourSampleData, type TourSampleData } from "@/lib/super/tour-data";
import { buildTourSteps, type TourStep } from "@/lib/super/tour-steps";

const ACTIVE_KEY = "la-super-tour-active";
const STEP_KEY = "la-super-tour-step";
const SEEN_KEY = "la-super-tutorial-seen";
export const TOUR_START_EVENT = "super-tour-start";

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Spotlight product tour for super admins. Mounted once in the app
 * layout so it survives client-side navigation (the layout doesn't
 * remount). Activates only when a launch button dispatches
 * `super-tour-start` (or, on first mount, if the active flag is already
 * set — e.g. the admin hard-refreshed mid-tour).
 *
 * Each step targets a real element by its `data-tour` attribute. The
 * overlay dims the page, punches a spotlight hole over the target, and
 * floats a tooltip with Back / Next. Next across a page boundary calls
 * router.push and the same persistent component picks up on the new
 * route. All page clicks are blocked while the tour runs — Back / Next
 * drive everything — so the admin can't wander off mid-tour.
 */
export function SuperTour({ superAdmin }: { superAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [sample, setSample] = useState<TourSampleData | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Memoize so step references are stable across renders — otherwise the
  // locate effect (keyed on `step`) would re-run every render and thrash
  // the rect/scroll listeners.
  const steps: TourStep[] = useMemo(
    () => (sample ? buildTourSteps(sample) : []),
    [sample],
  );
  const step: TourStep | null = active && steps.length ? (steps[stepIndex] ?? null) : null;

  const persist = useCallback((nextActive: boolean, nextStep: number) => {
    try {
      localStorage.setItem(ACTIVE_KEY, nextActive ? "1" : "0");
      localStorage.setItem(STEP_KEY, String(nextStep));
    } catch {
      // private-mode Safari — in-memory state still drives the tour
    }
  }, []);

  const loadSampleAndStart = useCallback(
    async (startStep: number) => {
      // Build steps from real IDs. If the fetch fails, fall back to a
      // sample with no IDs so the tour still runs its no-ID steps.
      let data: TourSampleData;
      try {
        data = await getTourSampleData();
      } catch {
        data = { orgId: null, orgName: null, memberUserId: null, memberOrgId: null };
      }
      setSample(data);
      setStepIndex(startStep);
      setActive(true);
      persist(true, startStep);
    },
    [persist],
  );

  // Launch trigger (custom event from the launch buttons).
  useEffect(() => {
    if (!superAdmin) return;
    function onStart() {
      void loadSampleAndStart(0);
    }
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [superAdmin, loadSampleAndStart]);

  // Resume-on-mount: if the admin hard-refreshed mid-tour, pick back up.
  useEffect(() => {
    if (!superAdmin) return;
    try {
      if (localStorage.getItem(ACTIVE_KEY) === "1") {
        const saved = Number.parseInt(localStorage.getItem(STEP_KEY) ?? "0", 10);
        void loadSampleAndStart(Number.isFinite(saved) ? saved : 0);
      }
    } catch {
      // ignore
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superAdmin]);

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    persist(false, 0);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
  }, [persist]);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= steps.length) {
        finish();
        return;
      }
      const next = steps[nextIndex];
      setStepIndex(nextIndex);
      persist(true, nextIndex);
      setRect(null);
      setMissingTarget(false);
      if (next.path !== pathname) {
        router.push(next.path);
      }
    },
    [steps, pathname, router, persist, finish],
  );

  // Locate + track the spotlight target for the current step.
  useEffect(() => {
    if (!step) return;
    // Wrong page (navigation in flight): wait for pathname to catch up.
    if (step.path !== pathname) {
      setRect(null);
      setMissingTarget(false);
      return;
    }
    // Centered step — no target.
    if (!step.selector) {
      setRect(null);
      setMissingTarget(false);
      return;
    }

    let cancelled = false;
    let tries = 0;
    const sel = `[data-tour="${step.selector}"]`;

    const measure = () => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      // Pad the spotlight a touch so the ring doesn't crowd the element.
      setRect({
        top: r.top - 6,
        left: r.left - 6,
        width: r.width + 12,
        height: r.height + 12,
      });
      return true;
    };

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Let the smooth scroll settle, then measure.
        setTimeout(() => {
          if (!cancelled) {
            if (!measure()) setMissingTarget(true);
          }
        }, 320);
        return;
      }
      tries += 1;
      if (tries > 20) {
        // ~2s of retries — the element isn't on this page. Fall back to a
        // centered card so the tour never dead-ends.
        setMissingTarget(true);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();

    // Keep the spotlight glued to the element through scroll/resize.
    const onMove = () => {
      if (!cancelled) measure();
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const interval = window.setInterval(onMove, 400);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.clearInterval(interval);
    };
  }, [step, pathname]);

  // Keyboard: Esc exits, arrows / Enter drive.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goTo(stepIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(stepIndex - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stepIndex, goTo, finish]);

  if (!superAdmin || !active || !step) return null;

  const onTargetPage = step.path === pathname;
  const spotlight = onTargetPage && step.selector && rect && !missingTarget ? rect : null;

  // Tooltip placement: below the spotlight if there's room, else above;
  // centered when there's no target.
  const cardWidth = 380;
  let cardStyle: React.CSSProperties;
  if (spotlight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const belowTop = spotlight.top + spotlight.height + 12;
    const placeBelow = belowTop + 200 < vh;
    const left = Math.min(Math.max(spotlight.left, 16), vw - cardWidth - 16);
    cardStyle = placeBelow
      ? { top: belowTop, left }
      : { bottom: vh - spotlight.top + 12, left };
  } else {
    cardStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const navigating = !onTargetPage;

  return (
    <div className="fixed inset-0 z-[200]" aria-live="polite" role="dialog" aria-modal="true">
      {/* Click-blocker. Captures every click so the admin can't wander
          off mid-tour; Back / Next drive everything. */}
      <div className="absolute inset-0" style={{ cursor: "default" }} />

      {/* Spotlight hole — a transparent box with a giant box-shadow that
          dims everything around it, plus an accent ring. pointer-events
          none so it's purely visual. */}
      {spotlight && (
        <div
          className="absolute rounded-lg"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(16, 29, 81, 0.55)",
            outline: "2px solid var(--t-accent)",
            outlineOffset: "2px",
            pointerEvents: "none",
            transition: "all 0.2s ease",
          }}
        />
      )}

      {/* Full dim when there's no target (centered card / navigating). */}
      {!spotlight && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(16, 29, 81, 0.55)", pointerEvents: "none" }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={cardRef}
        className="absolute"
        style={{ width: cardWidth, maxWidth: "calc(100vw - 32px)", ...cardStyle }}
      >
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--t-paper)",
            border: "1px solid var(--t-rule)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          }}
        >
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                Step {stepIndex + 1} of {steps.length}
              </span>
              <button
                type="button"
                onClick={finish}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint hover:text-ink"
              >
                Skip tour
              </button>
            </div>
            <h2
              className="mt-2 text-ink"
              style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400 }}
            >
              {step.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft">
              {navigating ? "Heading to the next screen…" : step.body}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex flex-wrap gap-1 px-5 pt-3">
            {steps.map((s, i) => (
              <span
                key={`${s.path}-${s.selector ?? "card"}-${i}`}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === stepIndex ? 18 : 6,
                  background: i <= stepIndex ? "var(--t-accent)" : "var(--t-rule)",
                }}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 px-5 pb-4">
            <button
              type="button"
              onClick={() => goTo(stepIndex - 1)}
              disabled={isFirst}
              className="rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-soft transition hover:text-ink disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => goTo(stepIndex + 1)}
              className="rounded-full px-4 py-1.5 text-[12px] font-medium text-white"
              style={{ background: "var(--t-accent)" }}
            >
              {step.cta ?? (isLast ? "Finish" : "Next →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
