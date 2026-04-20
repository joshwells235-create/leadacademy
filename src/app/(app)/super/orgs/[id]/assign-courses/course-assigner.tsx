"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  assignCourseToCoho,
  removeCourseFromCohort,
  updateCohortCourseSchedule,
} from "@/lib/super/actions";

type Cohort = { id: string; name: string };
type Course = { id: string; title: string; status: string };
type Assignment = {
  cohort_id: string;
  course_id: string;
  available_from: string | null;
  available_until: string | null;
  due_at: string | null;
};

const keyFor = (cohortId: string, courseId: string) => `${cohortId}::${courseId}`;

export function CourseAssigner({
  cohorts,
  courses,
  assignments,
}: {
  cohorts: Cohort[];
  courses: Course[];
  assignments: Assignment[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // Build a map for quick lookup. Re-derive whenever the server-passed
  // assignments change (after router.refresh()).
  const byKey = new Map<string, Assignment>();
  for (const a of assignments) byKey.set(keyFor(a.cohort_id, a.course_id), a);

  const toggle = (cohortId: string, courseId: string, isAssigned: boolean) => {
    start(async () => {
      if (isAssigned) await removeCourseFromCohort(cohortId, courseId);
      else await assignCourseToCoho(cohortId, courseId);
      router.refresh();
    });
  };

  if (cohorts.length === 0)
    return <p className="text-sm text-neutral-500">No cohorts in this org. Create one first.</p>;
  if (courses.length === 0)
    return (
      <p className="text-sm text-neutral-500">
        No published courses. Build and publish one in the Course Builder first.
      </p>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2 text-left font-medium">Course</th>
            {cohorts.map((c) => (
              <th key={c.id} className="px-3 py-2 text-center font-medium">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr
              key={course.id}
              className="border-b border-neutral-50 transition hover:bg-brand-light/40"
            >
              <td className="px-4 py-3 font-medium text-brand-navy align-top">{course.title}</td>
              {cohorts.map((cohort) => {
                const assignment = byKey.get(keyFor(cohort.id, course.id)) ?? null;
                const isAssigned = !!assignment;
                return (
                  <td key={cohort.id} className="px-3 py-3 align-top">
                    <div className="flex flex-col items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => toggle(cohort.id, course.id, isAssigned)}
                        disabled={pending}
                        className="rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
                      />
                      {isAssigned && (
                        <SchedulePicker
                          cohortId={cohort.id}
                          courseId={course.id}
                          initialFrom={assignment?.available_from ?? null}
                          initialUntil={assignment?.available_until ?? null}
                          initialDue={assignment?.due_at ?? null}
                        />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] text-neutral-500">
        Set <strong>Available from</strong> to schedule a future unlock; leave blank for immediate
        availability. <strong>Available until</strong> hides the course after the date.{" "}
        <strong>Due</strong> is a soft deadline — surfaced to learners and dashboards but never
        blocks completion.
      </p>
    </div>
  );
}

function SchedulePicker({
  cohortId,
  courseId,
  initialFrom,
  initialUntil,
  initialDue,
}: {
  cohortId: string;
  courseId: string;
  initialFrom: string | null;
  initialUntil: string | null;
  initialDue: string | null;
}) {
  const [from, setFrom] = useState(initialFrom ?? "");
  const [until, setUntil] = useState(initialUntil ?? "");
  const [due, setDue] = useState(initialDue ?? "");
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const router = useRouter();

  // Reset local state if the server-side dates change underneath us
  // (e.g. another tab edited them).
  useEffect(() => {
    setFrom(initialFrom ?? "");
    setUntil(initialUntil ?? "");
    setDue(initialDue ?? "");
  }, [initialFrom, initialUntil, initialDue]);

  const dirty =
    from !== (initialFrom ?? "") || until !== (initialUntil ?? "") || due !== (initialDue ?? "");

  const save = () => {
    setErrMsg(null);
    start(async () => {
      const res = await updateCohortCourseSchedule(cohortId, courseId, {
        available_from: from,
        available_until: until,
        due_at: due,
      });
      if ("error" in res) {
        setState("error");
        setErrMsg(res.error);
        return;
      }
      setState("saved");
      router.refresh();
    });
  };

  return (
    <div className="flex w-full max-w-[180px] flex-col gap-1 text-[11px] text-neutral-600">
      <label className="flex items-center justify-between gap-1">
        <span className="text-neutral-500">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setState("idle");
          }}
          className="w-[110px] rounded border border-neutral-300 px-1 py-0.5 text-[11px] focus:border-brand-blue focus:outline-none"
        />
      </label>
      <label className="flex items-center justify-between gap-1">
        <span className="text-neutral-500">Until</span>
        <input
          type="date"
          value={until}
          onChange={(e) => {
            setUntil(e.target.value);
            setState("idle");
          }}
          className="w-[110px] rounded border border-neutral-300 px-1 py-0.5 text-[11px] focus:border-brand-blue focus:outline-none"
        />
      </label>
      <label className="flex items-center justify-between gap-1">
        <span className="text-neutral-500">Due</span>
        <input
          type="date"
          value={due}
          onChange={(e) => {
            setDue(e.target.value);
            setState("idle");
          }}
          className="w-[110px] rounded border border-neutral-300 px-1 py-0.5 text-[11px] focus:border-brand-blue focus:outline-none"
        />
      </label>
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="self-end rounded bg-brand-blue px-2 py-0.5 text-[10px] font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      )}
      {state === "saved" && !dirty && (
        <span className="self-end text-[10px] text-emerald-600">Saved</span>
      )}
      {state === "error" && errMsg && (
        <span className="self-end text-[10px] text-brand-pink">{errMsg}</span>
      )}
    </div>
  );
}
