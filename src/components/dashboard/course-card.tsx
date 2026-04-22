import Link from "next/link";
import { Panel } from "@/components/design/panel";
import { MonoLabel } from "@/components/design/mono-label";

// The "picking up where you left off" card for a course in progress.
// Shows the module the learner is mid-way through, the next unfinished
// lesson, a blue progress bar (course progress is coach/learning-side
// blue, not Thought-Partner pink), and a Continue button. Falls back
// to a catalog-browsing nudge when nothing is in progress.
export function CourseCard({
  course,
}: {
  course: {
    courseId: string;
    courseTitle: string;
    moduleTitle: string | null;
    nextLesson: { id: string; title: string; durationMinutes: number | null } | null;
    percent: number;
  } | null;
}) {
  if (!course) {
    return (
      <Panel>
        <MonoLabel>Learn</MonoLabel>
        <p
          className="mt-3 leading-[1.3] text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 18 }}
        >
          Nothing in progress.
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
          When you start a course, it'll pick up here.
        </p>
        <Link
          href="/learning"
          className="mt-4 inline-flex rounded-full border px-4 py-2 text-[12px] text-ink transition hover:opacity-90"
          style={{ borderColor: "var(--t-rule)" }}
        >
          Browse courses →
        </Link>
      </Panel>
    );
  }

  const continueHref = course.nextLesson
    ? `/learning/${course.courseId}/${course.nextLesson.id}`
    : `/learning/${course.courseId}`;

  return (
    <Panel>
      <MonoLabel>
        Picking up{course.moduleTitle ? ` · ${course.moduleTitle}` : ""}
      </MonoLabel>

      <p
        className="mt-2 leading-[1.25] text-ink"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 18 }}
      >
        {course.nextLesson?.title ?? course.courseTitle}
      </p>
      {course.nextLesson?.durationMinutes != null && (
        <p className="mt-1 text-[12px] text-ink-soft">
          {course.nextLesson.durationMinutes} min
        </p>
      )}

      {/* 3px progress rail, accent blue fill. Course progress reads as
          coach-side (human-learning blue), not AI (pink). */}
      <div
        className="mt-3.5 h-[3px] rounded-[2px]"
        style={{ background: "var(--t-rule)" }}
      >
        <div
          className="h-[3px] rounded-[2px]"
          style={{
            width: `${Math.min(100, Math.max(0, course.percent))}%`,
            background: "var(--t-blue)",
          }}
        />
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <Link
          href={continueHref}
          className="inline-flex rounded-full border px-3.5 py-1.5 text-[12px] text-ink transition hover:opacity-90"
          style={{ borderColor: "var(--t-rule)" }}
        >
          Continue →
        </Link>
      </div>
    </Panel>
  );
}
