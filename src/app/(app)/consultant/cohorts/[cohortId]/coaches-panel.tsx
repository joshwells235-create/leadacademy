"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearLearnerCoach, setLearnerCoach } from "@/lib/consultant/actions";

export type CoachSummary = {
  userId: string;
  name: string;
  assignedCount: number;
};

export type LearnerAssignmentRow = {
  userId: string;
  name: string;
  coachUserId: string | null;
  coachName: string | null;
};

/**
 * Coaches-in-cohort panel with an inline "assign coach to a learner"
 * control. Two surfaces in one: at-a-glance coach load (so consultant
 * sees imbalance) plus a small form to rebalance.
 */
export function CoachesPanel({
  coaches,
  learners,
}: {
  coaches: CoachSummary[];
  learners: LearnerAssignmentRow[];
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleAssign = (learnerId: string) => {
    if (!selectedCoach) {
      setError("Pick a coach first.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await setLearnerCoach(learnerId, selectedCoach);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAssigning(null);
      setSelectedCoach("");
      router.refresh();
    });
  };

  const handleClear = (learnerId: string) => {
    if (
      !confirm(
        "Remove this learner's coach assignment? They'll need a new coach before their next 1:1.",
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await clearLearnerCoach(learnerId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-brand-navy">Coaches in this cohort</h2>
        <span className="text-[11px] text-neutral-500">
          {coaches.length} coach{coaches.length === 1 ? "" : "es"}
        </span>
      </div>

      {coaches.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500">
          No coaches assigned to this cohort yet. Your org admin adds coaches via{" "}
          <span className="font-medium">People</span>; once they're members, you can pair them with
          learners below.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-50">
          {coaches.map((c) => (
            <li key={c.userId} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-brand-navy">{c.name}</span>
              <span className="text-[11px] text-neutral-500">
                {c.assignedCount} learner{c.assignedCount === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {coaches.length > 0 && (
        <div className="border-t border-neutral-100 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Assign / change coach
          </p>
          {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
          <ul className="space-y-1.5">
            {learners.map((l) => (
              <li key={l.userId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                {assigning === l.userId ? (
                  <>
                    <select
                      value={selectedCoach}
                      onChange={(e) => setSelectedCoach(e.target.value)}
                      aria-label={`Pick a coach for ${l.name}`}
                      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                    >
                      <option value="">Select coach…</option>
                      {coaches.map((c) => (
                        <option key={c.userId} value={c.userId}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAssign(l.userId)}
                      disabled={pending || !selectedCoach}
                      className="rounded-md bg-brand-blue px-2 py-1 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
                    >
                      {pending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssigning(null);
                        setSelectedCoach("");
                        setError(null);
                      }}
                      disabled={pending}
                      className="text-[11px] text-neutral-500 hover:text-brand-navy"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-neutral-500">
                      {l.coachName ? (
                        <>Coach: {l.coachName}</>
                      ) : (
                        <span className="font-medium text-amber-700">No coach</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAssigning(l.userId);
                        setSelectedCoach(l.coachUserId ?? "");
                        setError(null);
                      }}
                      className="text-[11px] text-brand-blue hover:underline"
                    >
                      {l.coachName ? "Change" : "Assign"}
                    </button>
                    {l.coachName && (
                      <button
                        type="button"
                        onClick={() => handleClear(l.userId)}
                        disabled={pending}
                        className="text-[11px] text-neutral-500 hover:text-brand-pink disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
