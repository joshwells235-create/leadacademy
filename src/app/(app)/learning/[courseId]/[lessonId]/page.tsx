import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LessonViewer } from "@/components/editor/lesson-viewer";
import { LessonNotes } from "@/components/learning/lesson-notes";
import { LessonQuestions, type PriorQuestion } from "@/components/learning/lesson-questions";
import { ScrollResume } from "@/components/learning/scroll-resume";
import { type PlayerQuestion, QuizPlayer } from "@/components/quiz/quiz-player";
import { stampLessonStarted } from "@/lib/analytics/stamp-started";
import { computeSingleLessonGate } from "@/lib/learning/access-gate";
import { resolveVideoEmbed } from "@/lib/learning/video-embed";
import { createClient } from "@/lib/supabase/server";
import { MarkCompleteButton } from "./mark-complete-button";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function LessonViewerPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense in depth: the (app) layout redirects unauth users, but under
  // Next 16 RSC streaming the page body can still start rendering. Without
  // this guard `user.id` crashes with "Cannot read properties of null".
  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, description, duration_minutes, content, video_url, materials, type, module_id, order",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) notFound();

  // Prereq gate + schedule gate. If blocked, redirect to course overview with
  // a flash so the learner sees *why* and which lessons/courses they need to
  // complete first. Super-admins bypass — they need to preview locked content.
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) {
    // Schedule check first — if the course isn't available right now, bounce
    // to /learning rather than the course detail page (which would itself
    // bounce on the same rule).
    const { data: membership } = await supabase
      .from("memberships")
      .select("cohort_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (membership?.cohort_id) {
      const { data: assignment } = await supabase
        .from("cohort_courses")
        .select("available_from, available_until")
        .eq("cohort_id", membership.cohort_id)
        .eq("course_id", courseId)
        .maybeSingle();
      if (assignment) {
        const today = new Date().toISOString().slice(0, 10);
        if (
          (assignment.available_from && assignment.available_from > today) ||
          (assignment.available_until && assignment.available_until < today)
        ) {
          redirect("/learning");
        }
      }
    }

    const gate = await computeSingleLessonGate(supabase, user.id, lessonId);
    if (!gate.unlocked) {
      const blocker = gate.blockedBy[0]?.title ?? "another lesson";
      redirect(
        `/learning/${courseId}?locked=${encodeURIComponent(lesson.title)}&blocker=${encodeURIComponent(blocker)}`,
      );
    }
  }

  const isQuiz = lesson.type === "quiz";

  // Fire-and-forget: stamp started_at so drop-off + time-to-complete
  // analytics have a signal. Skipped for super-admins so preview views
  // don't muddy the metrics with author activity.
  if (!profile?.super_admin) {
    void stampLessonStarted({ userId: user.id, lessonId });
  }

  const [modRes, progressRes, siblingsRes, courseRes, linkedResourcesRes, noteRes, questionsRes] =
    await Promise.all([
      supabase.from("modules").select("title, course_id").eq("id", lesson.module_id).maybeSingle(),
      supabase
        .from("lesson_progress")
        .select("completed, last_scroll_pct")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle(),
      supabase
        .from("lessons")
        .select("id, title, order")
        .eq("module_id", lesson.module_id)
        .order("order"),
      supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
      supabase
        .from("lesson_resources")
        .select("order, resources(id, title, type, url)")
        .eq("lesson_id", lessonId)
        .order("order"),
      supabase
        .from("lesson_notes")
        .select("content")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle(),
      supabase
        .from("lesson_questions")
        .select(
          "id, question, ai_answer, asked_at, flagged_to_coach_at, coach_response, coach_responded_at, resolved_at",
        )
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .order("asked_at", { ascending: false })
        .limit(20),
    ]);

  // Quiz-specific load (only if quiz lesson).
  const [quizSettingsRes, quizQuestionsRes, quizAttemptsRes, lastAttemptRes] = isQuiz
    ? await Promise.all([
        supabase
          .from("quiz_settings")
          .select(
            "pass_percent, max_attempts, shuffle_questions, show_correct_answers, instructions",
          )
          .eq("lesson_id", lessonId)
          .maybeSingle(),
        supabase
          .from("quiz_questions")
          .select("id, type, prompt, explanation, points, order, config")
          .eq("lesson_id", lessonId)
          .order("order"),
        supabase
          .from("quiz_attempts")
          .select("id", { count: "exact", head: true })
          .eq("lesson_id", lessonId)
          .eq("user_id", user.id)
          .not("completed_at", "is", null),
        supabase
          .from("quiz_attempts")
          .select("score_percent, passed, attempt_number, completed_at, answers")
          .eq("lesson_id", lessonId)
          .eq("user_id", user.id)
          .order("attempt_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [null, null, null, null];

  const isCompleted = progressRes.data?.completed ?? false;
  const siblings = siblingsRes.data ?? [];
  const currentIdx = siblings.findIndex((s) => s.id === lessonId);
  const prevLesson = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextLesson = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  // Lesson X of Y *within this module* — a module-scoped counter is what
  // the learner actually wants ("where am I in this module?"). The earlier
  // course-wide counter was disorienting because modules can be very
  // different sizes.
  const positionInModule = currentIdx + 1;
  const totalInModule = siblings.length;

  const content =
    lesson.content && typeof lesson.content === "object" && "type" in (lesson.content as object)
      ? (lesson.content as JSONContent)
      : null;

  const initialScrollPct = progressRes.data?.last_scroll_pct ?? null;
  const initialNoteContent = noteRes.data?.content ?? "";
  const initialQuestions: PriorQuestion[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    aiAnswer: q.ai_answer,
    askedAt: q.asked_at,
    flaggedToCoachAt: q.flagged_to_coach_at,
    coachResponse: q.coach_response,
    coachRespondedAt: q.coach_responded_at,
    resolvedAt: q.resolved_at,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb — always visible so the learner never loses their place. */}
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-neutral-500"
      >
        <Link href="/learning" className="hover:text-brand-blue">
          Learning
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/learning/${courseId}`} className="hover:text-brand-blue">
          {courseRes.data?.title ?? "Course"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-neutral-700">{modRes.data?.title ?? "Module"}</span>
      </nav>

      <ScrollResume lessonId={lessonId} initialPct={initialScrollPct} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">
            {lesson.title}
            {isQuiz && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 align-middle">
                Quiz
              </span>
            )}
          </h1>
          {lesson.description && (
            <p className="mt-1 text-sm text-neutral-600">{lesson.description}</p>
          )}
          {lesson.duration_minutes && (
            <p className="mt-1 text-xs text-neutral-500">~{lesson.duration_minutes} min</p>
          )}
        </div>
        {totalInModule > 0 && (
          <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
            {isQuiz ? "Quiz" : "Lesson"} {positionInModule} of {totalInModule} in{" "}
            {modRes.data?.title ?? "this module"}
          </span>
        )}
      </div>

      {lesson.video_url &&
        (() => {
          const resolved = resolveVideoEmbed(lesson.video_url);
          if (!resolved) return null;
          return (
            <div className="mt-4 aspect-video max-w-2xl rounded-lg overflow-hidden border border-neutral-200">
              <iframe
                src={resolved.embedUrl}
                title="Lesson video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        })()}

      {content && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <LessonViewer content={content} />
        </div>
      )}

      {/* Quiz player — only for quiz-type lessons */}
      {isQuiz && (
        <div className="mt-6">
          {(() => {
            const questions = ((quizQuestionsRes?.data ?? []) as unknown as PlayerQuestion[]).map(
              (q) => ({
                ...q,
                config:
                  q.config && typeof q.config === "object" && !Array.isArray(q.config)
                    ? (q.config as Record<string, unknown>)
                    : {},
              }),
            );
            const settings = quizSettingsRes?.data
              ? {
                  pass_percent: quizSettingsRes.data.pass_percent,
                  max_attempts: quizSettingsRes.data.max_attempts,
                  shuffle_questions: quizSettingsRes.data.shuffle_questions,
                  show_correct_answers: quizSettingsRes.data.show_correct_answers,
                  instructions: quizSettingsRes.data.instructions,
                }
              : {
                  pass_percent: 80,
                  max_attempts: null,
                  shuffle_questions: false,
                  show_correct_answers: true,
                  instructions: null,
                };
            const lastAttempt = lastAttemptRes?.data
              ? {
                  score_percent: lastAttemptRes.data.score_percent,
                  passed: lastAttemptRes.data.passed,
                  attempt_number: lastAttemptRes.data.attempt_number,
                  completed_at: lastAttemptRes.data.completed_at,
                  answers:
                    lastAttemptRes.data.answers &&
                    typeof lastAttemptRes.data.answers === "object" &&
                    !Array.isArray(lastAttemptRes.data.answers)
                      ? (lastAttemptRes.data.answers as Record<string, unknown>)
                      : null,
                }
              : null;
            return (
              <QuizPlayer
                lessonId={lessonId}
                settings={settings}
                questions={questions}
                priorAttemptsCount={quizAttemptsRes?.count ?? 0}
                lastAttempt={lastAttempt}
              />
            );
          })()}
        </div>
      )}

      {/* Linked resources from the library */}
      {(linkedResourcesRes.data ?? []).length > 0 && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-brand-navy">Related resources</h2>
          <ul className="space-y-2">
            {(linkedResourcesRes.data ?? []).map((lr, idx) => {
              const r = lr.resources as unknown as {
                id: string;
                title: string;
                type: string;
                url: string;
              } | null;
              if (!r) return null;
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable ordering
                  key={idx}
                  className="flex items-center gap-2 rounded-md bg-brand-light px-3 py-2"
                >
                  <span className="rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-blue">
                    {r.type}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-blue hover:underline"
                  >
                    {r.title}
                  </a>
                  <span className="ml-auto text-xs text-neutral-400">Open ↗</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Materials / downloads */}
      {lesson.materials &&
        Array.isArray(lesson.materials) &&
        (lesson.materials as Array<{ name: string; url: string }>).length > 0 && (
          <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-brand-navy">Downloadable materials</h2>
            <ul className="space-y-2">
              {(lesson.materials as Array<{ name: string; url: string }>).map((m) => (
                <li
                  key={m.url}
                  className="flex items-center gap-2 rounded-md bg-brand-light px-3 py-2"
                >
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-blue hover:underline"
                  >
                    {m.name}
                  </a>
                  <span className="ml-auto text-xs text-neutral-400">Download ↗</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Private per-lesson notes — also feed LearnerContext so the
          thought partner knows what this learner has been flagging. */}
      <div className="mt-6">
        <LessonNotes lessonId={lessonId} initialContent={initialNoteContent} />
      </div>

      {/* Ask-the-room Q&A — thought partner answers grounded in lesson +
          learner context; one-click flag escalates to coach. */}
      <div className="mt-4">
        <LessonQuestions lessonId={lessonId} initialQuestions={initialQuestions} />
      </div>

      {/* Completion + navigation */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        {!isQuiz && (
          <div className="flex items-center justify-center mb-4">
            <MarkCompleteButton
              lessonId={lessonId}
              completed={isCompleted}
              nextLessonUrl={nextLesson ? `/learning/${courseId}/${nextLesson.id}` : undefined}
              courseUrl={`/learning/${courseId}`}
            />
          </div>
        )}
        {isQuiz && (
          <p className="text-xs text-neutral-500 text-center mb-3">
            Quizzes mark this lesson complete automatically when you pass.
          </p>
        )}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
          {prevLesson ? (
            <Link
              href={`/learning/${courseId}/${prevLesson.id}`}
              className="text-brand-blue hover:underline"
            >
              ← {prevLesson.title}
            </Link>
          ) : (
            <span />
          )}
          {nextLesson ? (
            <Link
              href={`/learning/${courseId}/${nextLesson.id}`}
              className="text-brand-blue hover:underline"
            >
              {nextLesson.title} →
            </Link>
          ) : (
            <Link href={`/learning/${courseId}`} className="text-brand-blue hover:underline">
              Back to course overview →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
