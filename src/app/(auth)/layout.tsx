import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-navy flex-col justify-between p-10 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue text-sm font-bold">
              LA
            </div>
            <span className="text-lg font-bold tracking-tight">LeadAcademy</span>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Build leaders.<br />
            Align teams.<br />
            Accelerate performance.
          </h2>
          <p className="mt-4 text-white/70 max-w-sm leading-relaxed">
            A leadership development platform powered by AI coaching, integrative goal-setting,
            and structured learning — built by LeadShift.
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
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-navy text-sm font-bold text-white mb-3">
              LA
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy">LeadAcademy</h1>
            <p className="mt-1 text-sm text-neutral-500">by LeadShift</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-neutral-400">
            Need help? Contact <a href="mailto:support@leadshift.com" className="text-brand-blue hover:underline">support@leadshift.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
