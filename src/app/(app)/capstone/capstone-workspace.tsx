"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  finalizeCapstone,
  reopenCapstone,
  shareCapstoneWithCoach,
  startCapstoneSession,
} from "@/lib/capstone/actions";

type SectionKind = "before" | "catalyst" | "shift" | "evidence" | "what_next";

type Section = {
  id?: string;
  kind?: SectionKind;
  heading?: string;
  body?: string;
  moments?: { title: string; description: string }[];
  pull_quotes?: { text: string; source: string }[];
  updated_at?: string;
};

type OutlineJson = {
  sections?: Section[];
  updated_by_ai_at?: string;
};

type OutlineRow = {
  id: string;
  outline: unknown;
  status: string;
  shared_at: string | null;
  finalized_at: string | null;
  conversation_id: string | null;
  updated_at: string;
};

type OutlineStatus = "draft" | "shared" | "finalized";

const SECTION_ORDER: SectionKind[] = ["before", "catalyst", "shift", "evidence", "what_next"];

const SECTION_LABEL: Record<SectionKind, string> = {
  before: "Before",
  catalyst: "Catalyst",
  shift: "Shift",
  evidence: "Evidence",
  what_next: "What's Next",
};

const SECTION_HINT: Record<SectionKind, string> = {
  before: "Who you were walking in — your default as a leader, what wasn't working.",
  catalyst: "What cracked open — the moment, finding, or conversation that shifted something.",
  shift: "How your thinking or stance changed — the reframe, in your words.",
  evidence: "Where the shift showed up in action — specific moments, not abstractions.",
  what_next: "What you carry forward into the next chapter beyond the program.",
};

export function CapstoneWorkspace({
  outline,
  cohortName,
}: {
  outline: OutlineRow | null;
  cohortName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const outlineJson = (outline?.outline ?? {}) as OutlineJson;
  const sectionsByKind = new Map<SectionKind, Section>();
  for (const s of outlineJson.sections ?? []) {
    if (s.kind && SECTION_ORDER.includes(s.kind)) {
      sectionsByKind.set(s.kind, s);
    }
  }
  const hasAnySection = sectionsByKind.size > 0;
  const allSectionsFilled = SECTION_ORDER.every((k) => sectionsByKind.has(k));

  const status: OutlineStatus =
    outline?.status === "shared" || outline?.status === "finalized" ? outline.status : "draft";

  const handleStart = () => {
    start(async () => {
      await startCapstoneSession();
      router.refresh();
    });
  };

  const handleShare = () => {
    start(async () => {
      await shareCapstoneWithCoach();
      router.refresh();
    });
  };

  const handleFinalize = () => {
    start(async () => {
      await finalizeCapstone();
      router.refresh();
    });
  };

  const handleReopen = () => {
    start(async () => {
      await reopenCapstone();
      router.refresh();
    });
  };

  // Entry state: no outline or no sections yet and no conversation started.
  if (!outline || (!hasAnySection && !outline.conversation_id)) {
    return (
      <div className="mt-6 rounded-xl border border-brand-blue/20 bg-white p-8 shadow-sm">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 text-2xl">
            ✨
          </div>
          <h2 className="text-xl font-bold text-brand-navy">Ready to build your story?</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Your thought partner will look across everything you've captured in {cohortName} —
            goals, sprints, actions, reflections, assessments — and propose a first draft of your
            9-month arc. From there, you'll work through it together, one section at a time.
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={pending}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[#1a2a6b] disabled:opacity-60"
          >
            {pending ? "Generating…" : "✨ Generate story outline"}
          </button>
          <p className="mt-3 text-xs text-neutral-500">
            This creates a conversation you can come back to anytime.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <StatusPill status={status} />
            <p className="mt-2 text-xs text-neutral-500">
              Last refined {new Date(outline.updated_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {outline.conversation_id && (
              <Link
                href={`/coach-chat?c=${outline.conversation_id}`}
                className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
              >
                Continue with thought partner →
              </Link>
            )}
            {status === "draft" && hasAnySection && (
              <button
                type="button"
                onClick={handleShare}
                disabled={pending}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-brand-light disabled:opacity-60"
              >
                Share with coach
              </button>
            )}
            {(status === "draft" || status === "shared") && allSectionsFilled && (
              <button
                type="button"
                onClick={handleFinalize}
                disabled={pending}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              >
                Mark as finalized
              </button>
            )}
            {status === "finalized" && (
              <button
                type="button"
                onClick={handleReopen}
                disabled={pending}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-brand-light disabled:opacity-60"
              >
                Reopen for edits
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {SECTION_ORDER.map((kind, idx) => {
          const section = sectionsByKind.get(kind);
          return <SectionCard key={kind} kind={kind} number={idx + 1} section={section} />;
        })}
      </div>

      <p className="text-center text-xs text-neutral-500">
        Refine sections with your thought partner — each one needs your approval before it saves
        here.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: OutlineStatus }) {
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    shared: "bg-brand-blue/10 text-brand-blue",
    finalized: "bg-emerald-100 text-emerald-800",
  };
  const label: Record<string, string> = {
    draft: "Draft — only you can see this",
    shared: "Shared with coach",
    finalized: "Finalized",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      {label[status]}
    </span>
  );
}

function SectionCard({
  kind,
  number,
  section,
}: {
  kind: SectionKind;
  number: number;
  section: Section | undefined;
}) {
  const filled = !!section?.body;
  return (
    <div
      className={`rounded-lg border bg-white p-5 shadow-sm ${
        filled ? "border-neutral-200" : "border-dashed border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand-navy">
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-pink">
              {SECTION_LABEL[kind]}
            </h3>
            {!filled && <span className="text-xs text-neutral-400">— not yet refined</span>}
          </div>
          {filled ? (
            <>
              <p className="mt-1 text-base font-semibold text-brand-navy">{section.heading}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {section.body}
              </p>
              {section.moments && section.moments.length > 0 && (
                <div className="mt-3 rounded-md bg-brand-light p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Moments
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                    {section.moments.map((m) => (
                      <li key={m.title}>
                        <span className="font-medium">{m.title}:</span> {m.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {section.pull_quotes && section.pull_quotes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {section.pull_quotes.map((q) => (
                    <blockquote
                      key={`${q.source}-${q.text.slice(0, 24)}`}
                      className="border-l-2 border-brand-blue pl-3 text-sm italic text-neutral-700"
                    >
                      "{q.text}"
                      <span className="ml-2 text-xs not-italic text-neutral-500">— {q.source}</span>
                    </blockquote>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">{SECTION_HINT[kind]}</p>
          )}
        </div>
      </div>
    </div>
  );
}
