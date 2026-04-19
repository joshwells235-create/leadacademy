import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-navy flex-col justify-between p-10 text-white">
        <div>
          <img src="/leadshift-logo.svg" alt="LeadShift" className="h-8 brightness-0 invert" />
          <p className="mt-2 text-sm text-white/60">Leadership Academy Platform</p>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Build leaders.
            <br />
            Align teams.
            <br />
            Accelerate performance.
          </h2>
          <p className="mt-4 text-white/70 max-w-sm leading-relaxed">
            A leadership development platform powered by AI coaching, integrative goal-setting, and
            structured learning — built by LeadShift.
          </p>
        </div>
        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} LeadShift. All rights reserved.
        </p>
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
