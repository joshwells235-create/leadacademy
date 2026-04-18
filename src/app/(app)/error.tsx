"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-pink-light">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-xl font-bold text-brand-navy">Something went wrong</h2>
        <p className="mt-2 text-sm text-neutral-600">
          An unexpected error occurred. This has been logged and we'll look into it.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-brand-blue px-6 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark transition"
        >
          Try again
        </button>
        <p className="mt-4 text-xs text-neutral-400">
          If this keeps happening, contact <a href="mailto:support@leadshift.com" className="text-brand-blue hover:underline">support@leadshift.com</a>
        </p>
      </div>
    </div>
  );
}
