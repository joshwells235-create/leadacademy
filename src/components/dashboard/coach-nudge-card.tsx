"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { dismissNudge } from "@/lib/nudges/actions";

type Props = {
  nudge: {
    id: string;
    title: string;
    body: string;
    link: string;
  };
};

export function CoachNudgeCard({ nudge }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleDismiss = () => {
    start(async () => {
      const res = await dismissNudge(nudge.id);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="relative mb-6 rounded-2xl border-2 border-brand-blue/20 bg-gradient-to-br from-brand-blue-light/30 to-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue">
            From your coach
          </p>
          <h2 className="mt-1 text-base font-bold text-brand-navy">{nudge.title}</h2>
          <p className="mt-1 text-sm text-neutral-700">{nudge.body}</p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={nudge.link}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              Talk it through →
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-white/60 disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          disabled={pending}
          className="flex-shrink-0 rounded-full p-1 text-neutral-400 hover:bg-white/60 hover:text-neutral-700 disabled:opacity-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <title>Dismiss</title>
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
