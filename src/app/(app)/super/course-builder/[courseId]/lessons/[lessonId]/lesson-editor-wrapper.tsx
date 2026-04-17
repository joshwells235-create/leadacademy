"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
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

type Material = { name: string; url: string; path?: string };

export function LessonEditorWrapper({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [materials, setMaterials] = useState<Material[]>(
    Array.isArray(lesson.materials) ? (lesson.materials as Material[]) : [],
  );
  const [content, setContent] = useState<JSONContent>(
    (lesson.content && typeof lesson.content === "object" && "type" in (lesson.content as object))
      ? (lesson.content as JSONContent)
      : { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [pending, start] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Track unsaved changes.
  const markUnsaved = useCallback(() => {
    setSaveState("unsaved");
  }, []);

  // Auto-save 3 seconds after last change.
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSave();
    }, 3000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = () => {
    start(async () => {
      setSaveState("saving");
      await updateLesson(lesson.id, courseId, {
        title,
        content: content as object,
        video_url: videoUrl || null,
        materials: materials as unknown as object,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 3000);
    });
  };

  // When content changes, mark unsaved + trigger auto-save.
  const handleContentChange = useCallback((newContent: JSONContent) => {
    setContent(newContent);
    markUnsaved();
    triggerAutoSave();
  }, [markUnsaved, triggerAutoSave]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const handleDelete = () => {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    start(async () => {
      await deleteLesson(lesson.id, courseId);
      router.push(`/super/course-builder/${courseId}`);
    });
  };

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", courseId);
      formData.append("lessonId", lesson.id);
      const res = await fetch("/api/course-content/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setMaterials((prev) => [...prev, { name: file.name, url: data.url, path: data.path }]);
        markUnsaved();
        triggerAutoSave();
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const removeMaterial = (idx: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
    markUnsaved();
    triggerAutoSave();
  };

  return (
    <div className="space-y-6">
      {/* Header with save controls */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); markUnsaved(); triggerAutoSave(); }}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-xl font-bold text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Lesson title"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs transition ${
            saveState === "saving" ? "text-amber-600" :
            saveState === "saved" ? "text-emerald-600" :
            saveState === "unsaved" ? "text-amber-500" :
            "text-neutral-400"
          }`}>
            {saveState === "saving" ? "Saving..." :
             saveState === "saved" ? "✓ Saved" :
             saveState === "unsaved" ? "● Unsaved changes" :
             ""}
          </span>
          <button onClick={doSave} disabled={pending} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60">
            Save now
          </button>
          <button onClick={handleDelete} className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:text-brand-pink hover:border-brand-pink">
            Delete
          </button>
        </div>
      </div>

      {/* Video URL */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-brand-navy mb-1">Video (optional)</label>
        <p className="text-xs text-neutral-500 mb-2">Paste a YouTube, Vimeo, or Loom URL. The video will appear at the top of the lesson for learners.</p>
        <input
          value={videoUrl}
          onChange={(e) => { setVideoUrl(e.target.value); markUnsaved(); triggerAutoSave(); }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        {videoUrl && (
          <div className="mt-3 aspect-video max-w-xl rounded-lg overflow-hidden border border-neutral-200">
            <iframe src={videoUrl.replace("watch?v=", "embed/")} className="h-full w-full" allowFullScreen />
          </div>
        )}
      </div>

      {/* Rich content editor */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-brand-navy">Lesson content</label>
          <span className="text-xs text-neutral-500">Auto-saves 3 seconds after you stop typing</span>
        </div>
        <LessonEditor
          content={content}
          onChange={handleContentChange}
          courseId={courseId}
          lessonId={lesson.id}
        />
      </div>

      {/* File attachments / downloadable materials */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-brand-navy mb-1">Downloadable materials</label>
        <p className="text-xs text-neutral-500 mb-3">PDFs, worksheets, templates — files learners can download alongside this lesson.</p>

        {materials.length > 0 && (
          <ul className="space-y-2 mb-3">
            {materials.map((m, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-neutral-200 bg-brand-light px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📄</span>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-blue hover:underline">{m.name}</a>
                </div>
                <button onClick={() => removeMaterial(i)} className="text-xs text-neutral-400 hover:text-brand-pink">Remove</button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadingFile}
          className="rounded-md border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:border-brand-blue hover:text-brand-blue transition disabled:opacity-60"
        >
          {uploadingFile ? "Uploading..." : "+ Upload a file"}
        </button>
      </div>
    </div>
  );
}
