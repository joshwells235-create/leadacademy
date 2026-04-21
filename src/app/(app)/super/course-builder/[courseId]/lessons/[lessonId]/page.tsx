import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrereqPicker } from "@/components/learning/prereq-picker";
import { createClient } from "@/lib/supabase/server";
import { LessonEditorWrapper } from "./lesson-editor-wrapper";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function LessonEditorPage({ params }: Props) {
  const { courseId, lessonId } = await params;
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

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, description, duration_minutes, type, content, video_url, materials, quiz, module_id, order",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) notFound();

  // Fetch context: course name, module name, sibling lessons for prev/next nav.
  const [
    courseRes,
    modRes,
    siblingsRes,
    linkedResourcesRes,
    allResourcesRes,
    quizSettingsRes,
    quizQuestionsRes,
    quizAttemptsRes,
    courseModulesRes,
    lessonPrereqsRes,
  ] = await Promise.all([
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("title").eq("id", lesson.module_id).maybeSingle(),
    supabase
      .from("lessons")
      .select("id, title, order")
      .eq("module_id", lesson.module_id)
      .order("order"),
    supabase
      .from("lesson_resources")
      .select("resource_id, order, resources(id, title, type, url)")
      .eq("lesson_id", lessonId)
      .order("order"),
    supabase.from("resources").select("id, title, type").order("title"),
    supabase
      .from("quiz_settings")
      .select("pass_percent, max_attempts, shuffle_questions, show_correct_answers, instructions")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
    supabase
      .from("quiz_questions")
      .select("id, type, prompt, explanation, points, order, config")
      .eq("lesson_id", lessonId)
      .order("order"),
    supabase
      .from("quiz_attempts")
      .select("user_id, score_percent, passed, answers, completed_at")
      .eq("lesson_id", lessonId)
      .not("completed_at", "is", null),
    // Sibling-course lessons (across modules) for the prereq picker.
    supabase
      .from("modules")
      .select("id, title, order, lessons(id, title, order)")
      .eq("course_id", courseId)
      .order("order"),
    supabase.from("lesson_prerequisites").select("required_lesson_id").eq("lesson_id", lessonId),
  ]);

  const attemptsForAnalytics = quizAttemptsRes.data ?? [];

  // Aggregate quiz analytics. Per-question correctness is read from the
  // stored per-question `answers.{qid}.correct` that submitQuizAttempt
  // writes; passes come from `passed`.
  const totalAttempts = attemptsForAnalytics.length;
  const uniqueLearners = new Set(attemptsForAnalytics.map((a) => a.user_id)).size;
  const passRate =
    totalAttempts === 0
      ? 0
      : attemptsForAnalytics.filter((a) => a.passed === true).length / totalAttempts;
  const averageScore =
    totalAttempts === 0
      ? 0
      : attemptsForAnalytics.reduce((s, a) => s + (a.score_percent ?? 0), 0) / totalAttempts;

  const perQuestionStats: Array<{
    questionId: string;
    prompt: string;
    correctRate: number;
    attempts: number;
  }> = [];
  for (const q of quizQuestionsRes.data ?? []) {
    let answered = 0;
    let correct = 0;
    for (const a of attemptsForAnalytics) {
      const answers =
        a.answers && typeof a.answers === "object" && !Array.isArray(a.answers)
          ? (a.answers as Record<string, unknown>)
          : {};
      const forQ = answers[q.id];
      if (forQ && typeof forQ === "object" && "correct" in forQ) {
        answered += 1;
        if ((forQ as { correct: boolean }).correct) correct += 1;
      }
    }
    if (answered > 0) {
      perQuestionStats.push({
        questionId: q.id,
        prompt: q.prompt,
        correctRate: correct / answered,
        attempts: answered,
      });
    }
  }

  const quizAnalytics = {
    totalAttempts,
    uniqueLearners,
    passRate,
    averageScore,
    perQuestion: perQuestionStats,
  };

  const siblings = siblingsRes.data ?? [];
  const currentIdx = siblings.findIndex((s) => s.id === lessonId);
  const prevLesson = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextLesson = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  // Build prereq picker options: every other lesson in this course, scoped
  // by module so the author can locate them quickly. The DB cycle trigger
  // catches loops; we don't pre-filter here (allowing cross-module prereqs).
  type ModuleWithLessons = {
    id: string;
    title: string;
    order: number;
    lessons: { id: string; title: string; order: number }[] | null;
  };
  const courseModules = (courseModulesRes.data ?? []) as ModuleWithLessons[];
  const prereqOptions = courseModules.flatMap((m) =>
    (m.lessons ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((l) => l.id !== lessonId)
      .map((l) => ({ id: l.id, title: l.title, sublabel: m.title })),
  );
  const selectedPrereqIds = (lessonPrereqsRes.data ?? []).map((r) => r.required_lesson_id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/course-builder" className="hover:text-brand-blue">
          Courses
        </Link>
        <span>/</span>
        <Link href={`/super/course-builder/${courseId}`} className="hover:text-brand-blue">
          {courseRes.data?.title ?? "Course"}
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{modRes.data?.title ?? "Module"}</span>
        <span>/</span>
        <span className="font-medium text-brand-navy">{lesson.title}</span>
      </nav>

      <LessonEditorWrapper
        lesson={lesson}
        courseId={courseId}
        prevLesson={prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null}
        nextLesson={nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null}
        linkedResources={(linkedResourcesRes.data ?? [])
          .map((r) => {
            const res = r.resources as unknown as {
              id: string;
              title: string;
              type: string;
              url: string;
            } | null;
            return res ? { id: res.id, title: res.title, type: res.type, url: res.url } : null;
          })
          .filter((r): r is { id: string; title: string; type: string; url: string } => r !== null)}
        allResources={(allResourcesRes.data ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
        }))}
        quizSettings={
          quizSettingsRes.data
            ? {
                pass_percent: quizSettingsRes.data.pass_percent,
                max_attempts: quizSettingsRes.data.max_attempts,
                shuffle_questions: quizSettingsRes.data.shuffle_questions,
                show_correct_answers: quizSettingsRes.data.show_correct_answers,
                instructions: quizSettingsRes.data.instructions,
              }
            : null
        }
        quizAnalytics={quizAnalytics}
        quizQuestions={(quizQuestionsRes.data ?? []).map((q) => ({
          id: q.id,
          type: q.type as
            | "single_choice"
            | "multi_choice"
            | "true_false"
            | "short_answer"
            | "matching"
            | "ordering",
          prompt: q.prompt,
          explanation: q.explanation,
          points: q.points,
          order: q.order,
          config:
            q.config && typeof q.config === "object" && !Array.isArray(q.config)
              ? (q.config as Record<string, unknown>)
              : {},
        }))}
      />

      <div className="mt-6">
        <PrereqPicker
          kind="lesson"
          targetId={lessonId}
          initialSelected={selectedPrereqIds}
          options={prereqOptions}
        />
      </div>
    </div>
  );
}
