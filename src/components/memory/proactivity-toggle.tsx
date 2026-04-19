"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setProactivityEnabled } from "@/lib/memory/actions";

type Props = {
  initialEnabled: boolean;
};

export function ProactivityToggle({ initialEnabled }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () => {
    start(async () => {
      const res = await setProactivityEnabled(!initialEnabled);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-brand-navy">Proactive check-ins</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Let your thought partner reach out when it notices something worth talking about — a
            quiet stretch on a goal, a challenge that didn't get marked, momentum worth naming.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-neutral-500">
            <li>At most 2 nudges per 7-day window (total, not per-topic).</li>
            <li>Each topic has a 14-day cooldown so you won't get the same prompt twice.</li>
            <li>Dismissing a nudge counts toward the weekly cap — we won't spam you back.</li>
            <li>
              Turn this off any time; nothing else about how your thought partner works changes.
            </li>
          </ul>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={initialEnabled}
          aria-label={`Proactive check-ins ${initialEnabled ? "on — tap to turn off" : "off — tap to turn on"}`}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
            initialEnabled ? "bg-brand-blue" : "bg-neutral-300"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              initialEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
          <span className="sr-only">Proactive check-ins {initialEnabled ? "on" : "off"}</span>
        </button>
      </div>
    </section>
  );
}
