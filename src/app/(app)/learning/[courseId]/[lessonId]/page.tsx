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

  const { data: lesson } = await supabase.from("lessons").select("id, title, content, video_url, materials, type, module_id").eq("id", lessonId).maybeSingle();
  if (!lesson) notFound();

  const { data: mod } = await supabase.from("modules").select("title").eq("id", lesson.module_id).maybeSingle();

  const { data: progress } = await supabase.from("lesson_progress").select("completed").eq("user_id", user!.id).eq("lesson_id", lessonId).maybeSingle();
  const isCompleted = progress?.completed ?? false;

  // Get next lesson in this module.
  const { data: nextLesson } = await supabase.from("lessons").select("id, title").eq("module_id", lesson.module_id).gt("order", 0).order("order").limit(1).maybeSingle();

  const content = (lesson.content && typeof lesson.content === "object" && "type" in (lesson.content as object))
    ? (lesson.content as JSONContent)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 text-xs text-neutral-500">
        <Link href={`/learning/${courseId}`} className="hover:text-neutral-700">← Back to course</Link>
        {mod && <span className="mx-1">/</span>}
        {mod && <span>{mod.title}</span>}
      </div>

      <h1 className="text-2xl font-semibold text-brand-navy">{lesson.title}</h1>

      {lesson.video_url && (
        <div className="mt-4 aspect-video max-w-2xl">
          <iframe
            src={lesson.video_url.replace("watch?v=", "embed/")}
            className="h-full w-full rounded-lg"
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
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-2">Materials</h2>
          <ul className="space-y-1">
            {(lesson.materials as Array<{ name: string; url: string }>).map((m, i) => (
              <li key={i}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-blue underline hover:text-brand-blue-dark">{m.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <MarkCompleteButton lessonId={lessonId} completed={isCompleted} />
        {nextLesson && (
          <Link href={`/learning/${courseId}/${nextLesson.id}`} className="text-sm text-brand-blue hover:text-brand-blue-dark">
            Next: {nextLesson.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
