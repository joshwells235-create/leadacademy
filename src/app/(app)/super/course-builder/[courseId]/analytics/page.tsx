import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCourseStats } from "@/lib/analytics/course-stats";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ cohortId?: string }>;
};

export default async function CourseAnalyticsPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const { cohortId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, status")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) notFound();

  // Cohort filter UI — pull every cohort this course is assigned to.
  const { data: cohortRows } = await supabase
    .from("cohort_courses")
    .select("cohort_id, cohorts(id, name, organizations(name))")
    .eq("course_id", courseId);

  type Option = { id: string; label: string };
  const cohortOptions: Option[] = (
    (cohortRows ?? []) as unknown as Array<{
      cohort_id: string;
      cohorts: {
        id: string;
        name: string;
        organizations: { name: string } | { name: string }[] | null;
      } | null;
    }>
  )
    .map((r) => {
      if (!r.cohorts) return null;
      const org = Array.isArray(r.cohorts.organizations)
        ? r.cohorts.organizations[0]
        : r.cohorts.organizations;
      return {
        id: r.cohort_id,
        label: `${r.cohorts.name}${org ? ` · ${org.name}` : ""}`,
      };
    })
    .filter((x): x is Option => x !== null);

  const stats = await getCourseStats(supabase, courseId, cohortId);

  const startRate = stats.enrolled > 0 ? stats.started / stats.enrolled : 0;
  const completionRate = stats.started > 0 ? stats.completed / stats.started : 0;
  const medianLabel = formatMinutes(stats.medianMinutesToComplete);

  // Biggest drop-off: step where completion count drops the most from
  // its predecessor. Helpful for an at-a-glance "rework this lesson"
  // cue. Skips the first step (no predecessor).
  const biggestDrop = (() => {
    let worstIdx = -1;
    let worstDrop = 0;
    for (let i = 1; i < stats.steps.length; i += 1) {
      const drop = stats.steps[i - 1].completed - stats.steps[i].completed;
      if (drop > worstDrop) {
        worstDrop = drop;
        worstIdx = i;
      }
    }
    return worstIdx >= 0 && worstDrop > 0 ? { step: stats.steps[worstIdx], drop: worstDrop } : null;
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/course-builder" className="hover:text-brand-blue">
          Courses
        </Link>
        <span>/</span>
        <Link href={`/super/course-builder/${courseId}`} className="hover:text-brand-blue">
          {course.title}
        </Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">Analytics</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{course.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Engagement + completion signals across the learners assigned this course.
          </p>
        </div>
      </div>

      {/* Cohort filter */}
      {cohortOptions.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500">Scope:</span>
          <CohortChip href={`/super/course-builder/${courseId}/analytics`} active={!cohortId}>
            All cohorts
          </CohortChip>
          {cohortOptions.map((opt) => (
            <CohortChip
              key={opt.id}
              href={`/super/course-builder/${courseId}/analytics?cohortId=${opt.id}`}
              active={cohortId === opt.id}
            >
              {opt.label}
            </CohortChip>
          ))}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Kpi label="Enrolled" value={stats.enrolled.toString()} />
        <Kpi
          label="Started"
          value={stats.started.toString()}
          detail={stats.enrolled > 0 ? `${Math.round(startRate * 100)}% of enrolled` : null}
        />
        <Kpi
          label="Completed"
          value={stats.completed.toString()}
          detail={stats.started > 0 ? `${Math.round(completionRate * 100)}% of starters` : null}
          tone={
            stats.started === 0
              ? "neutral"
              : completionRate >= 0.7
                ? "good"
                : completionRate >= 0.4
                  ? "neutral"
                  : "warn"
          }
        />
        <Kpi
          label="Median time to complete"
          value={medianLabel ?? "—"}
          detail={stats.completed > 0 ? `across ${stats.completed} completers` : null}
        />
      </div>

      {/* AI-engagement row — the differentiator. Peers can ship completion
          rate; nobody can ship "how many of your completers integrated
          the learning via an AI debrief" + "how many asked questions
          mid-lesson and got grounded answers." */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border-l-[3px] border-brand-pink bg-brand-pink-light/40 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-pink">
            Completers who debriefed
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-navy">
            {stats.debriefsAmongCompleters}
            <span className="ml-1 text-sm font-normal text-neutral-500">of {stats.completed}</span>
            {stats.debriefsStarted > stats.debriefsAmongCompleters && (
              <span className="ml-2 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] text-brand-blue align-middle">
                +{stats.debriefsStarted - stats.debriefsAmongCompleters} in progress
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {stats.completed === 0
              ? "No completers yet. Debriefs fire from the course-complete banner."
              : stats.debriefsAmongCompleters / Math.max(1, stats.completed) >= 0.5
                ? "Strong integration — more than half of completers bridged the course to real leadership situations with their thought partner."
                : "Room to grow. The 48h debrief nudge re-prompts completers who miss the moment."}
          </p>
        </div>

        <div className="rounded-lg border-l-[3px] border-brand-pink bg-brand-pink-light/40 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-pink">
            Questions asked mid-lesson
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-navy">
            {stats.questionsAsked}
            {stats.questionsFlagged > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 align-middle">
                {stats.questionsFlagged} escalated to coach
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {stats.questionsAsked === 0
              ? "Learners haven't asked anything yet. The panel lives inline on every lesson."
              : stats.questionsFlagged / Math.max(1, stats.questionsAsked) >= 0.4
                ? "High escalation rate — the AI answers aren't landing. Worth auditing the lesson content."
                : "Most questions are resolving with the AI's first-pass answer. Coaches only see the ones that actually need them."}
          </p>
        </div>
      </div>

      {/* Quiet-learner + biggest-drop callouts */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Callout
          tone={stats.quietLearners > 0 ? "warn" : "good"}
          title={
            stats.quietLearners > 0
              ? `${stats.quietLearners} learner${stats.quietLearners === 1 ? "" : "s"} quiet for 14+ days`
              : "No learners have gone quiet"
          }
          body={
            stats.quietLearners > 0
              ? "Consider a nudge from the coach or a cohort-wide check-in."
              : "Everyone with a started lesson has touched it recently."
          }
        />
        <Callout
          tone={biggestDrop ? "warn" : "neutral"}
          title={biggestDrop ? `Biggest drop: "${biggestDrop.step.title}"` : "No standout drop-off"}
          body={
            biggestDrop
              ? `${biggestDrop.drop} learner${biggestDrop.drop === 1 ? "" : "s"} fewer completed this step than the previous one. Worth auditing the lesson.`
              : "Completion tracks steadily across the course."
          }
        />
      </div>

      {/* Drop-off bar */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">Drop-off by lesson</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              How many learners reached each step. Steep drops between adjacent bars flag the
              lessons to rework.
            </p>
          </div>
        </div>

        {stats.steps.length === 0 ? (
          <p className="text-xs italic text-neutral-500">No lessons in this course yet.</p>
        ) : (
          <ol className="space-y-2">
            {stats.steps.map((s, idx) => {
              const max = Math.max(1, ...stats.steps.map((st) => st.completed + st.inProgress));
              const completedPct = ((s.completed + s.inProgress) / max) * 100;
              const completedOnlyPct = (s.completed / max) * 100;
              return (
                <li key={s.lessonId}>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right text-xs font-semibold text-neutral-400">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-brand-navy">
                          {s.title}
                          {s.kind === "quiz" && (
                            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                              Quiz
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {s.completed} / {stats.enrolled}
                          {s.inProgress > 0 && ` · ${s.inProgress} in progress`}
                          {s.firstTryPassRate !== null && (
                            <span className="ml-2 text-neutral-400">
                              · first-try {Math.round(s.firstTryPassRate * 100)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded bg-neutral-100 overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-brand-blue/30"
                          style={{ width: `${completedPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-brand-blue"
                          style={{ width: `${completedOnlyPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded bg-brand-blue" />
            Completed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded bg-brand-blue/30" />
            In progress
          </span>
        </div>
      </section>
    </div>
  );
}

function formatMinutes(min: number | null): string | null {
  if (min === null) return null;
  if (min < 60) return `${min}m`;
  const hours = min / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function Kpi({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string | null;
  tone?: "good" | "warn" | "neutral";
}) {
  const valueClass = {
    good: "text-emerald-600",
    warn: "text-danger",
    neutral: "text-brand-navy",
  }[tone];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-neutral-500">{detail}</p>}
    </div>
  );
}

function Callout({
  tone,
  title,
  body,
}: {
  tone: "good" | "warn" | "neutral";
  title: string;
  body: string;
}) {
  const classes = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    neutral: "border-neutral-200 bg-white text-brand-navy",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 ${classes}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs opacity-80">{body}</p>
    </div>
  );
}

function CohortChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 font-medium transition ${
        active ? "bg-brand-navy text-white" : "bg-brand-light text-neutral-700 hover:bg-neutral-200"
      }`}
    >
      {children}
    </Link>
  );
}
