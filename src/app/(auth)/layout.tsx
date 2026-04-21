import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-navy flex-col justify-between p-12 text-white">
        <div>
          <img src="/leadshift-logo.svg" alt="LeadShift" className="h-8 brightness-0 invert" />
          <p className="section-mark mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Leadership Academy
          </p>
        </div>
        <div className="max-w-md">
          {/* The pitch is deliberately specific. Nothing here would describe
              Lessonly, Notion, or a fintech onboarding flow. That's the point. */}
          <h2 className="font-serif text-[40px] font-medium leading-[1.15] tracking-tight">
            Leaders are made in the small choices between sessions.
          </h2>
          <p className="mt-6 font-serif text-base leading-[1.65] text-white/75">
            We sit with you in those moments. A thought partner that knows your goals, your
            assessments, the conversation you had with your coach last Tuesday — and your human
            coach behind it.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">What you won't find here</p>
          <p className="font-serif text-sm leading-relaxed text-white/65">
            Streaks. Badges. Leaderboards. A "you're on fire!" notification at 9pm. Leadership
            isn't a game, and we don't dress it up like one.
          </p>
          <p className="pt-6 text-[11px] text-white/35">
            &copy; {new Date().getFullYear()} LeadShift
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-brand-light">
        <div className="w-full max-w-md">
          {/* Mobile-only logo */}
          <div className="mb-8 text-center lg:hidden">
            <img src="/leadshift-logo.svg" alt="LeadShift" className="h-7 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">Leadership Academy Platform</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-neutral-400">
            Need help? Contact{" "}
            <a href="mailto:support@leadshift.com" className="text-brand-blue hover:underline">
              support@leadshift.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
