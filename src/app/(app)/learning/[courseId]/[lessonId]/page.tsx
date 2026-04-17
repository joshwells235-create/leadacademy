import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonViewer } from "@/components/editor/lesson-viewer";
import { MarkCompleteButton } from "./mark-complete-button";
import type { JSONContent } from "@tiptap/react";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function LessonViewerPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: lesson } = await supabase.from("lessons").select("id, title, content, video_url, materials, type, module_id, order").eq("id", lessonId).maybeSingle();
  if (!lesson) notFound();

  const [modRes, progressRes, siblingsRes, courseRes] = await Promise.all([
    supabase.from("modules").select("title").eq("id", lesson.module_id).maybeSingle(),
    supabase.from("lesson_progress").select("completed").eq("user_id", user!.id).eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lessons").select("id, title, order").eq("module_id", lesson.module_id).order("order"),
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
  ]);

  const isCompleted = progressRes.data?.completed ?? false;

  // Find actual previous and next lessons by order.
  const siblings = siblingsRes.data ?? [];
  const currentIdx = siblings.findIndex((s) => s.id === lessonId);
  const prevLesson = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextLesson = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  const content = (lesson.content && typeof lesson.content === "object" && "type" in (lesson.content as object))
    ? (lesson.content as JSONContent)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/learning" className="hover:text-brand-blue">Learning</Link>
        <span>/</span>
        <Link href={`/learning/${courseId}`} className="hover:text-brand-blue">{courseRes.data?.title ?? "Course"}</Link>
        <span>/</span>
        <span className="text-neutral-700">{modRes.data?.title ?? "Module"}</span>
      </nav>

      <h1 className="text-2xl font-bold text-brand-navy">{lesson.title}</h1>

      {lesson.video_url && (
        <div className="mt-4 aspect-video max-w-2xl rounded-lg overflow-hidden border border-neutral-200">
          <iframe
            src={lesson.video_url.replace("watch?v=", "embed/")}
            className="h-full w-full"
            allowFullScreen
          />
        </div>
      )}

      {content && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <LessonViewer content={content} />
        </div>
      )}

      {/* Materials / downloads */}
      {lesson.materials && Array.isArray(lesson.materials) && (lesson.materials as Array<{ name: string; url: string }>).length > 0 && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-navy mb-3">Downloadable materials</h2>
          <ul className="space-y-2">
            {(lesson.materials as Array<{ name: string; url: string }>).map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>📄</span>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-blue hover:underline">{m.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Completion + navigation */}
      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center mb-4">
          <MarkCompleteButton lessonId={lessonId} completed={isCompleted} />
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
          {prevLesson ? (
            <Link href={`/learning/${courseId}/${prevLesson.id}`} className="text-sm text-brand-blue hover:underline">
              ← {prevLesson.title}
            </Link>
          ) : <span />}
          {nextLesson ? (
            <Link href={`/learning/${courseId}/${nextLesson.id}`} className="text-sm text-brand-blue hover:underline">
              {nextLesson.title} →
            </Link>
          ) : (
            <Link href={`/learning/${courseId}`} className="text-sm text-brand-blue hover:underline">
              Back to course overview →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
