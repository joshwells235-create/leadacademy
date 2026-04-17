import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-brand-light">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-navy text-sm font-bold text-white mb-3">
            LA
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy">LeadAcademy</h1>
          <p className="mt-1 text-sm text-neutral-500">Leadership development platform</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
