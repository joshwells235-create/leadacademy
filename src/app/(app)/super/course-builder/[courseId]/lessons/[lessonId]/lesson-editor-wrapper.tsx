"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LessonEditor } from "@/components/editor/lesson-editor";
import { updateLesson, deleteLesson } from "@/lib/learning/actions";
import type { JSONContent } from "@tiptap/react";
import type { Json } from "@/lib/types/database";

type Lesson = {
  id: string;
  title: string;
  type: string;
  content: Json;
  video_url: string | null;
  materials: Json;
  quiz: Json;
  module_id: string;
};

export function LessonEditorWrapper({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [content, setContent] = useState<JSONContent>(
    (lesson.content && typeof lesson.content === "object" && "type" in (lesson.content as object))
      ? (lesson.content as JSONContent)
      : { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const handleSave = () => {
    start(async () => {
      await updateLesson(lesson.id, courseId, {
        title,
        content: content as object,
        video_url: videoUrl || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this lesson?")) return;
    start(async () => {
      await deleteLesson(lesson.id, courseId);
      router.push(`/super/course-builder/${courseId}`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-xl font-semibold focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          placeholder="Lesson title"
        />
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
          <button onClick={handleSave} disabled={pending} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60">
            {pending ? "Saving..." : "Save"}
          </button>
          <button onClick={handleDelete} className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Delete</button>
        </div>
      </div>

      {/* Video URL */}
      <div>
        <label className="block text-sm font-medium text-brand-navy mb-1">Video URL (YouTube, Vimeo, Loom)</label>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        {videoUrl && (
          <div className="mt-2 aspect-video max-w-xl">
            <iframe src={videoUrl.replace("watch?v=", "embed/")} className="h-full w-full rounded-lg" allowFullScreen />
          </div>
        )}
      </div>

      {/* Rich content editor */}
      <div>
        <label className="block text-sm font-medium text-brand-navy mb-1">Lesson content</label>
        <LessonEditor
          content={content}
          onChange={setContent}
          courseId={courseId}
          lessonId={lesson.id}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Use the toolbar for headings, bold, lists, images, video embeds, and links.
          Images upload to Supabase Storage automatically.
        </p>
      </div>
    </div>
  );
}
