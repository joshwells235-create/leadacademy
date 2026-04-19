"use client";

import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LessonEditor } from "@/components/editor/lesson-editor";
import { QuizAnalytics, type QuizAnalyticsData } from "@/components/quiz/quiz-analytics";
import { QuizBuilder, type QuizQuestion, type QuizSettings } from "@/components/quiz/quiz-builder";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import {
  deleteLesson,
  linkLessonResource,
  unlinkLessonResource,
  updateLesson,
} from "@/lib/learning/actions";
import { providerLabel, resolveVideoEmbed } from "@/lib/learning/video-embed";
import type { Json } from "@/lib/types/database";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  type: string;
  content: Json;
  video_url: string | null;
  materials: Json;
  quiz: Json;
  module_id: string;
};

type LinkedResource = { id: string; title: string; type: string; url: string };
type ResourceOption = { id: string; title: string; type: string };

type Material = { name: string; url: string; path?: string };

type SiblingLesson = { id: string; title: string } | null;

export function LessonEditorWrapper({
  lesson,
  courseId,
  prevLesson,
  nextLesson,
  linkedResources = [],
  allResources = [],
  quizSettings = null,
  quizQuestions = [],
  quizAnalytics,
}: {
  lesson: Lesson;
  courseId: string;
  prevLesson?: SiblingLesson;
  nextLesson?: SiblingLesson;
  linkedResources?: LinkedResource[];
  allResources?: ResourceOption[];
  quizSettings?: QuizSettings | null;
  quizQuestions?: QuizQuestion[];
  quizAnalytics?: QuizAnalyticsData;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [lessonType, setLessonType] = useState<string>(lesson.type || "lesson");
  const [description, setDescription] = useState(lesson.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState(lesson.duration_minutes?.toString() ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [materials, setMaterials] = useState<Material[]>(
    Array.isArray(lesson.materials) ? (lesson.materials as Material[]) : [],
  );
  const [content, setContent] = useState<JSONContent>(
    lesson.content && typeof lesson.content === "object" && "type" in (lesson.content as object)
      ? (lesson.content as JSONContent)
      : { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [pending, start] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Use refs for auto-save to avoid stale closures.
  const titleRef = useRef(title);
  const typeRef = useRef(lessonType);
  const descriptionRef = useRef(description);
  const durationRef = useRef(durationMinutes);
  const contentRef = useRef(content);
  const videoUrlRef = useRef(videoUrl);
  const materialsRef = useRef(materials);
  titleRef.current = title;
  typeRef.current = lessonType;
  descriptionRef.current = description;
  durationRef.current = durationMinutes;
  contentRef.current = content;
  videoUrlRef.current = videoUrl;
  materialsRef.current = materials;

  const doSave = useCallback(() => {
    start(async () => {
      setSaveState("saving");
      const durationRaw = durationRef.current.trim();
      const durationValue = durationRaw === "" ? null : Number.parseInt(durationRaw, 10);
      await updateLesson(lesson.id, courseId, {
        title: titleRef.current,
        type: typeRef.current,
        description: descriptionRef.current.trim() || null,
        duration_minutes: Number.isFinite(durationValue as number) ? durationValue : null,
        content: contentRef.current as object,
        video_url: videoUrlRef.current || null,
        materials: materialsRef.current as unknown as object,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 3000);
    });
  }, [lesson.id, courseId]);

  const markUnsaved = useCallback(() => setSaveState("unsaved"), []);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doSave, 3000);
  }, [doSave]);

  const handleChange = useCallback(() => {
    markUnsaved();
    scheduleAutoSave();
  }, [markUnsaved, scheduleAutoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const handleDelete = () => {
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
        handleChange();
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const removeMaterial = (idx: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
    handleChange();
  };

  return (
    <div className="space-y-6">
      {/* Header: title + save + nav */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              handleChange();
            }}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-xl font-bold text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Lesson title"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-600">Type:</label>
            <div className="inline-flex rounded-md border border-neutral-300 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => {
                  setLessonType("lesson");
                  handleChange();
                }}
                className={`px-3 py-1 ${
                  lessonType !== "quiz"
                    ? "bg-brand-blue text-white"
                    : "bg-white text-neutral-600 hover:bg-brand-light"
                }`}
              >
                Lesson
              </button>
              <button
                type="button"
                onClick={() => {
                  setLessonType("quiz");
                  handleChange();
                }}
                className={`px-3 py-1 border-l border-neutral-300 ${
                  lessonType === "quiz"
                    ? "bg-brand-pink text-white"
                    : "bg-white text-neutral-600 hover:bg-brand-light"
                }`}
              >
                Quiz
              </button>
            </div>
            {lessonType === "quiz" && (
              <span className="text-[11px] text-neutral-500">
                Quiz passes gate lesson completion.
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs transition ${
              saveState === "saving"
                ? "text-amber-600"
                : saveState === "saved"
                  ? "text-emerald-600"
                  : saveState === "unsaved"
                    ? "text-amber-500"
                    : "text-neutral-400"
            }`}
          >
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "✓ Saved"
                : saveState === "unsaved"
                  ? "● Unsaved"
                  : ""}
          </span>
          <button
            onClick={doSave}
            disabled={pending}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            Save now
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:text-brand-pink hover:border-brand-pink"
          >
            Delete
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmBlock
          title={`Delete "${title || "Untitled lesson"}"?`}
          tone="destructive"
          confirmLabel="Delete lesson"
          pending={pending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        >
          Removes this lesson and any learner progress against it. Cannot be undone.
        </ConfirmBlock>
      )}

      {/* Previous / Next lesson navigation */}
      <div className="flex items-center justify-between text-sm">
        {prevLesson ? (
          <Link
            href={`/super/course-builder/${courseId}/lessons/${prevLesson.id}`}
            className="text-brand-blue hover:underline"
          >
            ← {prevLesson.title}
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={`/learning/${courseId}/${lesson.id}`}
          target="_blank"
          className="rounded-md border border-brand-blue/30 px-3 py-1 text-xs text-brand-blue hover:bg-brand-blue-light transition"
        >
          Preview as learner ↗
        </Link>
        {nextLesson ? (
          <Link
            href={`/super/course-builder/${courseId}/lessons/${nextLesson.id}`}
            className="text-brand-blue hover:underline"
          >
            {nextLesson.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Description + duration */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-1">
            Short description (optional)
          </label>
          <p className="text-xs text-neutral-500 mb-2">
            1-2 sentences shown on the course overview and above the full content. Help learners
            decide if this lesson is what they need right now.
          </p>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              handleChange();
            }}
            rows={2}
            maxLength={500}
            placeholder="e.g. The 3-question frame for giving feedback that lands without making the other person defensive."
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-navy">
            Estimated minutes
            <input
              type="number"
              min={0}
              max={600}
              value={durationMinutes}
              onChange={(e) => {
                setDurationMinutes(e.target.value);
                handleChange();
              }}
              placeholder="—"
              className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <span className="text-xs text-neutral-500">
              Rolls up to the course total + gives learners a time budget.
            </span>
          </label>
        </div>
      </div>

      {/* Video URL */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-brand-navy mb-1">Video (optional)</label>
        <p className="text-xs text-neutral-500 mb-2">
          Paste a YouTube, Vimeo, or Loom URL. Appears at the top of the lesson.
        </p>
        <div className="flex gap-2">
          <input
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              handleChange();
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          {videoUrl && (
            <button
              onClick={() => {
                setVideoUrl("");
                handleChange();
              }}
              className="text-xs text-neutral-400 hover:text-brand-pink"
            >
              Clear
            </button>
          )}
        </div>
        <VideoEmbedPreview videoUrl={videoUrl} />
      </div>

      {/* Rich content editor */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-brand-navy">Lesson content</label>
          <span className="text-xs text-neutral-500">Auto-saves 3s after you stop typing</span>
        </div>
        <LessonEditor
          content={content}
          onChange={(c) => {
            setContent(c);
            handleChange();
          }}
          courseId={courseId}
          lessonId={lesson.id}
        />
      </div>

      {/* File attachments */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-brand-navy mb-1">
          Downloadable materials
        </label>
        <p className="text-xs text-neutral-500 mb-3">
          PDFs, worksheets, templates — files learners can download alongside this lesson.
        </p>

        {materials.length > 0 && (
          <ul className="space-y-2 mb-3">
            {materials.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border border-neutral-200 bg-brand-light px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📄</span>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-blue hover:underline"
                  >
                    {m.name}
                  </a>
                </div>
                <button
                  onClick={() => removeMaterial(i)}
                  className="text-xs text-neutral-400 hover:text-brand-pink"
                >
                  Remove
                </button>
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

      {/* Quiz builder — only when type is quiz */}
      {lessonType === "quiz" && (
        <>
          <QuizBuilder lessonId={lesson.id} settings={quizSettings} questions={quizQuestions} />
          {quizAnalytics && <QuizAnalytics data={quizAnalytics} />}
        </>
      )}

      {/* Linked resources from the library */}
      <LinkedResourcesPanel lessonId={lesson.id} linked={linkedResources} all={allResources} />
    </div>
  );
}

function LinkedResourcesPanel({
  lessonId,
  linked,
  all,
}: {
  lessonId: string;
  linked: LinkedResource[];
  all: ResourceOption[];
}) {
  const [picker, setPicker] = useState<string>("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const linkedIds = new Set(linked.map((r) => r.id));
  const available = all.filter((r) => !linkedIds.has(r.id));

  const addResource = () => {
    if (!picker) return;
    setError(null);
    const target = picker;
    setPicker("");
    start(async () => {
      const res = await linkLessonResource(lessonId, target);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const removeResource = (resourceId: string) => {
    setError(null);
    start(async () => {
      const res = await unlinkLessonResource(lessonId, resourceId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-2">
        <label className="block text-sm font-medium text-brand-navy">
          Related resources (optional)
        </label>
        <p className="text-xs text-neutral-500">
          Link articles, videos, or worksheets from the{" "}
          <Link href="/super/resources" className="text-brand-blue hover:underline">
            resource library
          </Link>
          . Shown to learners alongside this lesson as recommended reading.
        </p>
      </div>

      {linked.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {linked.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 bg-brand-light/40 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-blue">
                  {r.type}
                </span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-navy hover:text-brand-blue truncate"
                >
                  {r.title}
                </a>
              </div>
              <button
                type="button"
                onClick={() => removeResource(r.id)}
                disabled={pending}
                className="text-xs text-neutral-400 hover:text-brand-pink disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            aria-label="Pick a resource to link"
          >
            <option value="">— pick a resource to attach —</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                [{r.type}] {r.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addResource}
            disabled={pending || !picker}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            Attach
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          No more resources to link — every resource in the library is already attached.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function VideoEmbedPreview({ videoUrl }: { videoUrl: string }) {
  if (!videoUrl.trim()) return null;
  const resolved = resolveVideoEmbed(videoUrl);
  if (!resolved) {
    return (
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Can't recognize this video URL. Paste a YouTube (e.g. youtube.com/watch?v=… or youtu.be/…),
        Vimeo, or Loom share/embed link.
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="aspect-video max-w-xl rounded-lg overflow-hidden border border-neutral-200">
        <iframe
          src={resolved.embedUrl}
          title={`${providerLabel(resolved.provider)} video preview`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        Embedded as {providerLabel(resolved.provider)} video.
      </p>
    </div>
  );
}
