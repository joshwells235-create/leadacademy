import type { ReactNode } from "react";
import { AccentWord } from "@/components/design/accent-word";

// Auth layout — the first visual impression of Leadership Academy.
// Split chrome: editorial brand panel on the left carries the product's
// thesis in serif typography; the form card on the right sits on the
// warm paper ground with the themed Panel surface. The brand panel
// stays deep navy regardless of theme — it's a brand touchstone, not
// an app surface, and the contrast is deliberate.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      {/* Left: brand panel — always deep navy, never themed. */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12"
        style={{ background: "#101d51", color: "rgba(255,255,255,0.95)" }}
      >
        <div>
          <p
            className="leading-none"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Leadership <AccentWord>Academy</AccentWord>
          </p>
          <p
            className="mt-3 font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            By LeadShift
          </p>
        </div>
        <div className="max-w-md">
          {/* The pitch is deliberately specific. Nothing here would describe
              Lessonly, Notion, or a fintech onboarding flow. That's the point. */}
          <h2
            className="leading-[1.1]"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 40,
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            Leaders are made in the small choices <AccentWord>between sessions.</AccentWord>
          </h2>
          <p
            className="mt-6 leading-[1.65]"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 16,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            We sit with you in those moments. A thought partner that knows your
            goals, your assessments, the conversation you had with your coach
            last Tuesday — and your human coach behind it.
          </p>
        </div>
        <div className="space-y-2">
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            What you won't find here
          </p>
          <p
            className="leading-[1.55]"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 13.5,
              color: "rgba(255,255,255,0.65)",
            }}
          >
            Streaks. Badges. Leaderboards. A "you're on fire!" notification at
            9pm. Leadership isn't a game, and we don't dress it up like one.
          </p>
          <p
            className="pt-6 font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            &copy; {new Date().getFullYear()} LeadShift
          </p>
        </div>
      </div>

      {/* Right: form — lives on the themed ground. */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 py-12"
        style={{ background: "var(--t-bg)" }}
      >
        <div className="w-full max-w-md">
          {/* Mobile-only lockup */}
          <div className="mb-8 text-center lg:hidden">
            <p
              className="leading-none text-ink"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Leadership <AccentWord>Academy</AccentWord>
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              By LeadShift
            </p>
          </div>
          <div
            className="p-8"
            style={{
              background: "var(--t-paper)",
              border: "1px solid var(--t-rule)",
              borderRadius: "var(--t-radius-lg)",
              boxShadow: "var(--t-panel-shadow)",
            }}
          >
            {children}
          </div>
          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Need help? Contact{" "}
            <a href="mailto:support@leadshift.com" className="text-accent hover:opacity-80">
              support@leadshift.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
