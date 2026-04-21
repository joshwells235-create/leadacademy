import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccentWord } from "@/components/design/accent-word";
import { Panel } from "@/components/design/panel";
import { LessonViewer } from "@/components/editor/lesson-viewer";
import { LessonNotes } from "@/components/learning/lesson-notes";
import { LessonQuestions, type PriorQuestion } from "@/components/learning/lesson-questions";
import { ScrollResume } from "@/components/learning/scroll-resume";
import { type PlayerQuestion, QuizPlayer } from "@/components/quiz/quiz-player";
import { stampLessonStarted } from "@/lib/analytics/stamp-started";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { computeSingleLessonGate } from "@/lib/learning/access-gate";
import { resolveVideoEmbed } from "@/lib/learning/video-embed";
import { createClient } from "@/lib/supabase/server";
import { MarkCompleteButton } from "./mark-complete-button";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

// Lesson Viewer — editorial-system shell. Preserves every functional
// sub-piece (Tiptap lesson viewer, quiz player, linked resources,
// materials, lesson notes feeding LearnerContext, ask-the-room Q&A,
// ScrollResume, mark-complete). Hero is the only thing visually
// rebuilt: breadcrumb mono row, 2px rule progress bar, mono module
// label, serif 48px h1 with italic-accent tail.
//
// The heavy-dep dynamic-import pattern in LessonViewer + the
// gate-bypass rules for super-admin + coach-primary viewers are both
// load-bearing and untouched.
export default async function LessonViewerPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense in depth — `(app)/layout.tsx` already redirects unauth
  // users, but under Next 16 RSC streaming the page body can race the
  // layout and start rendering before the redirect resolves.
  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, description, duration_minutes, content, video_url, materials, type, module_id, order",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) notFound();

  // Prereq + schedule gate. Super-admins and coach-primary viewers
  // bypass — they're previewing, not enrolled.
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  const roleCtx = await getUserRoleContext(supabase, user.id);
  const isPreviewViewer = !!profile?.super_admin || roleCtx.coachPrimary;
  if (!isPreviewViewer) {
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

  // Fire-and-forget started-at stamp — skipped for preview viewers
  // so their browsing doesn't muddy drop-off / time-to-complete.
  if (!isPreviewViewer) {
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

  // Lesson X of Y within this module. Module-scoped counter reads
  // more meaningfully than course-wide when modules are uneven sizes.
  const positionInModule = currentIdx + 1;
  const totalInModule = siblings.length;
  const modulePct =
    totalInModule > 0 ? Math.round((positionInModule / totalInModule) * 100) : 0;

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

  const { head: titleHead, tail: titleTail } = splitAccent(lesson.title);

  return (
    <div className="mx-auto max-w-[860px] px-6 py-9 lg:px-9 lg:py-10">
      {/* Breadcrumb row — mono labels, left + right. The right side
          carries lesson position + duration, mirroring the design's
          "Lesson 3 of 6 · 12 min". */}
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.15em]"
      >
        <Link
          href={`/learning/${courseId}`}
          className="text-ink-soft transition hover:text-ink"
        >
          ← {courseRes.data?.title ?? "Course"}
        </Link>
        <span className="text-ink-faint">
          {isQuiz ? "Quiz" : "Lesson"} {positionInModule} of {totalInModule}
          {lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ""}
        </span>
      </nav>

      {/* 2px progress rail — rule color with accent fill at module %. */}
      <div
        className="mb-10 h-[2px] rounded-[1px]"
        style={{ background: "var(--t-rule)" }}
      >
        <div
          className="h-[2px] rounded-[1px] transition-[width] duration-500"
          style={{ width: `${modulePct}%`, background: "var(--t-accent)" }}
        />
      </div>

      <ScrollResume lessonId={lessonId} initialPct={initialScrollPct} />

      {/* Mono module label */}
      {modRes.data?.title && (
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {modRes.data.title}
        </p>
      )}

      {/* Serif 48 hero with italic-accent tail */}
      <h1
        className="mb-8 leading-[1.08] text-ink"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(32px, 5vw, 48px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        {titleHead} {titleTail && <AccentWord>{titleTail}</AccentWord>}
        {isQuiz && (
          <span
            className="ml-3 align-middle rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{
              background: "var(--t-accent-soft)",
              color: "var(--t-accent)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Quiz
          </span>
        )}
      </h1>

      {lesson.description && (
        <p className="mb-10 max-w-[680px] text-[15px] leading-[1.65] text-ink-soft">
          {lesson.description}
        </p>
      )}

      {lesson.video_url &&
        (() => {
          const resolved = resolveVideoEmbed(lesson.video_url);
          if (!resolved) return null;
          return (
            <div
              className="mt-2 mb-8 aspect-video overflow-hidden"
              style={{
                border: "1px solid var(--t-rule)",
                borderRadius: "var(--t-radius-lg)",
              }}
            >
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

      {/* Tiptap body — the LessonViewer owns its own typography via
          sanitize-html + prose classes, but we wrap it in a themed
          Panel so the surface matches the rest of the page. */}
      {content && (
        <Panel className="mb-8">
          <LessonViewer content={content} />
        </Panel>
      )}

      {/* Quiz player — unchanged */}
      {isQuiz && (
        <div className="mb-8">
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

      {/* Linked library resources */}
      {(linkedResourcesRes.data ?? []).length > 0 && (
        <Panel className="mb-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Related resources
          </p>
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
                  className="flex items-center gap-2.5 rounded-md px-3 py-2"
                  style={{ background: "var(--t-rule)", opacity: 0.9 }}
                >
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                    style={{
                      background: "var(--t-accent-soft)",
                      color: "var(--t-accent)",
                    }}
                  >
                    {r.type}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-ink transition hover:text-accent"
                  >
                    {r.title}
                  </a>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    Open ↗
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Downloadable materials */}
      {lesson.materials &&
        Array.isArray(lesson.materials) &&
        (lesson.materials as Array<{ name: string; url: string }>).length > 0 && (
          <Panel className="mb-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              Downloadable materials
            </p>
            <ul className="space-y-2">
              {(lesson.materials as Array<{ name: string; url: string }>).map((m) => (
                <li
                  key={m.url}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2"
                  style={{ background: "var(--t-rule)", opacity: 0.9 }}
                >
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-ink transition hover:text-accent"
                  >
                    {m.name}
                  </a>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    Download ↗
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

      {/* Lesson notes — private scratchpad that also feeds the TP's
          context on every chat turn. */}
      <div className="mb-6">
        <LessonNotes lessonId={lessonId} initialContent={initialNoteContent} />
      </div>

      {/* Ask-the-room Q&A */}
      <div className="mb-10">
        <LessonQuestions lessonId={lessonId} initialQuestions={initialQuestions} />
      </div>

      {/* Footer: Previous + Complete + Next. The Complete button lives
          centered between the nav links. When the learner finishes the
          last lesson of the last module, Phase 7 will swap this for the
          CourseCompleteModal trigger. For now, the existing
          mark-complete flow handles auto-advance. */}
      <div
        className="mt-10 flex items-center justify-between pt-6"
        style={{ borderTop: "1px solid var(--t-rule)" }}
      >
        {prevLesson ? (
          <Link
            href={`/learning/${courseId}/${prevLesson.id}`}
            className="inline-flex items-center rounded-full border px-4.5 py-2.5 text-[13px] font-medium text-ink transition hover:opacity-90"
            style={{ borderColor: "var(--t-rule)" }}
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}

        {!isQuiz && (
          <MarkCompleteButton
            lessonId={lessonId}
            completed={isCompleted}
            nextLessonUrl={nextLesson ? `/learning/${courseId}/${nextLesson.id}` : undefined}
            courseUrl={`/learning/${courseId}`}
          />
        )}
        {isQuiz && (
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Passing the quiz marks this complete.
          </p>
        )}

        {nextLesson ? (
          <Link
            href={`/learning/${courseId}/${nextLesson.id}`}
            className="inline-flex items-center rounded-full px-4.5 py-2.5 text-[13px] font-medium text-white transition"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 4px 20px var(--t-accent-soft)",
            }}
          >
            {nextLesson.title} →
          </Link>
        ) : (
          <Link
            href={`/learning/${courseId}`}
            className="inline-flex items-center rounded-full px-4.5 py-2.5 text-[13px] font-medium text-white transition"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 4px 20px var(--t-accent-soft)",
            }}
          >
            Back to course overview →
          </Link>
        )}
      </div>
    </div>
  );
}

// Split the lesson title's last word for italic-accent rendering.
// Falls back to no accent when the title is too short to carry it.
function splitAccent(title: string): { head: string; tail: string } {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 3) return { head: title.trim(), tail: "" };
  const tail = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(" ");
  return { head, tail };
}
