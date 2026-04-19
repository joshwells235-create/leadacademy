"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { endGoalSprint, startGoalSprint } from "@/lib/goals/actions";

type Sprint = {
  id: string;
  sprint_number: number;
  title: string;
  practice: string;
  planned_end_date: string;
  actual_end_date: string | null;
  status: string;
  action_count: number;
  created_at: string;
};

type Props = {
  goalId: string;
  sprints: Sprint[];
};

export function SprintSection({ goalId, sprints }: Props) {
  const ordered = [...sprints].sort((a, b) => a.sprint_number - b.sprint_number);
  const active = ordered.find((s) => s.status === "active") ?? null;
  const history = ordered.filter((s) => s.status !== "active");
  const [starting, setStarting] = useState(false);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sprints</h2>
        <span className="text-xs text-neutral-500">
          Translate the goal into something you can practice
        </span>
      </div>

      {active ? (
        <ActiveSprintCard sprint={active} />
      ) : (
        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
          No active sprint. A sprint is a 4-8 week window with a specific behavior you'll practice —
          that's what makes progress feelable.
        </div>
      )}

      <div className="mt-4">
        {starting ? (
          <StartSprintForm
            goalId={goalId}
            hasActive={!!active}
            onClose={() => setStarting(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setStarting(true)}
            className="rounded-md border border-brand-blue bg-white px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
          >
            {active ? "End this sprint & start a new one" : "Start a sprint"}
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Past sprints
          </h3>
          <ul className="space-y-2">
            {history
              .slice()
              .reverse()
              .map((s) => (
                <li
                  key={s.id}
                  className="rounded border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Sprint {s.sprint_number}: {s.title}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {s.action_count} action{s.action_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600">Practiced: {s.practice}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {s.created_at.slice(0, 10)} → {s.actual_end_date ?? s.planned_end_date}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ActiveSprintCard({ sprint }: { sprint: Sprint }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const startDate = sprint.created_at.slice(0, 10);
  const totalDays = Math.max(1, daysBetween(startDate, sprint.planned_end_date));
  const dayNumber = Math.min(daysBetween(startDate, today) + 1, totalDays);
  const daysRemaining = daysBetween(today, sprint.planned_end_date);
  const progress = Math.min(100, Math.round((dayNumber / totalDays) * 100));

  const handleEnd = () => {
    if (!confirm("End this sprint without starting a new one?")) return;
    start(async () => {
      const res = await endGoalSprint(sprint.id);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
            Sprint {sprint.sprint_number} — active
          </p>
          <p className="mt-1 text-base font-bold text-brand-navy">{sprint.title}</p>
          <p className="mt-1 text-sm text-neutral-700">Practicing: {sprint.practice}</p>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          disabled={pending}
          className="flex-shrink-0 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-white/60 disabled:opacity-50"
        >
          End sprint
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600">
        <span>
          Day {dayNumber} of {totalDays}
        </span>
        <span>·</span>
        <span>{daysRemaining} days remaining</span>
        <span>·</span>
        <span className="font-medium text-brand-blue">
          {sprint.action_count} action{sprint.action_count === 1 ? "" : "s"} logged
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div className="h-full bg-brand-blue transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function StartSprintForm({
  goalId,
  hasActive,
  onClose,
}: {
  goalId: string;
  hasActive: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [practice, setPractice] = useState("");
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await startGoalSprint({
        goalId,
        title: title.trim(),
        practice: practice.trim(),
        plannedEndDate: endDate,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-brand-blue/30 bg-white p-4"
    >
      {hasActive && (
        <p className="text-xs text-amber-700">
          Starting this sprint will close out your current one.
        </p>
      )}
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Sprint title
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          placeholder="Making the hand-off stick"
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          What specifically will you practice?
        </span>
        <textarea
          value={practice}
          onChange={(e) => setPractice(e.target.value)}
          maxLength={500}
          required
          rows={2}
          placeholder="Resist rewriting direct reports' drafts before they ship"
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none"
        />
        <span className="mt-1 block text-xs text-neutral-500">
          One specific behavior — verb-first and concrete enough to notice yourself doing or not
          doing.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Sprint ends
        </span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          required
          className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none"
        />
        <span className="mt-1 block text-xs text-neutral-500">Typical sprints run 4-8 weeks.</span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !title.trim() || !practice.trim() || !endDate}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {hasActive ? "End current & start this" : "Start sprint"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-brand-light"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 42);
  return d.toISOString().slice(0, 10);
}
