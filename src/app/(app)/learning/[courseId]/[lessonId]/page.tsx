import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LessonViewer } from "@/components/editor/lesson-viewer";
import { type PlayerQuestion, QuizPlayer } from "@/components/quiz/quiz-player";
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

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, description, duration_minutes, content, video_url, materials, type, module_id, order",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) notFound();

  // Prereq gate. If blocked, redirect to course overview with a flash so the
  // learner sees *why* and which lessons/courses they need to complete first.
  // Super-admins bypass — they need to be able to preview locked content.
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!profile?.super_admin) {
    const gate = await computeSingleLessonGate(supabase, user!.id, lessonId);
    if (!gate.unlocked) {
      const blocker = gate.blockedBy[0]?.title ?? "another lesson";
      redirect(
        `/learning/${courseId}?locked=${encodeURIComponent(lesson.title)}&blocker=${encodeURIComponent(blocker)}`,
      );
    }
  }

  const isQuiz = lesson.type === "quiz";

  const [modRes, progressRes, siblingsRes, courseRes, linkedResourcesRes] = await Promise.all([
    supabase.from("modules").select("title, course_id").eq("id", lesson.module_id).maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("completed")
      .eq("user_id", user!.id)
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
          .eq("user_id", user!.id)
          .not("completed_at", "is", null),
        supabase
          .from("quiz_attempts")
          .select("score_percent, passed, attempt_number, completed_at, answers")
          .eq("lesson_id", lessonId)
          .eq("user_id", user!.id)
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">
            {lesson.title}
            {isQuiz && (
              <span className="ml-2 rounded-full bg-brand-pink/10 px-2 py-0.5 text-xs font-medium text-brand-pink align-middle">
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

      {/* Completion + navigation */}
      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
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
