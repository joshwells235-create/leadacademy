"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { assignCourseToCoho, removeCourseFromCohort } from "@/lib/super/actions";

type Cohort = { id: string; name: string };
type Course = { id: string; title: string; status: string };

export function CourseAssigner({
  cohorts,
  courses,
  assignments,
}: {
  cohorts: Cohort[];
  courses: Course[];
  assignments: Record<string, string[]>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

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
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
            <th className="text-left px-4 py-2 font-medium">Course</th>
            {cohorts.map((c) => (
              <th key={c.id} className="text-center px-3 py-2 font-medium">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr
              key={course.id}
              className="border-b border-neutral-50 hover:bg-brand-light transition"
            >
              <td className="px-4 py-3 font-medium text-brand-navy">{course.title}</td>
              {cohorts.map((cohort) => {
                const isAssigned = (assignments[cohort.id] ?? []).includes(course.id);
                return (
                  <td key={cohort.id} className="text-center px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => toggle(cohort.id, course.id, isAssigned)}
                      disabled={pending}
                      className="rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
