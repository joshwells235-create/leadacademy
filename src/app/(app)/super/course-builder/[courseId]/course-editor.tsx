"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import {
  createLesson,
  createModule,
  deleteCourse,
  deleteModule,
  updateCourse,
  updateModule,
} from "@/lib/learning/actions";

type Course = { id: string; title: string; description: string | null; status: string };
type Module = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  duration_minutes: number | null;
};
type Lesson = {
  id: string;
  module_id: string;
  title: string;
  type: string;
  order: number;
  video_url?: string | null;
  content?: unknown;
};

export function CourseEditor({
  course,
  modules,
  lessonsByModule,
}: {
  course: Course;
  modules: Module[];
  lessonsByModule: Record<string, Lesson[] | undefined>;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [status, setStatus] = useState(course.status);
  const [pending, start] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const router = useRouter();

  // Refs for stale-closure-safe saving.
  const titleRef = useRef(title);
  const descRef = useRef(description);
  const statusRef = useRef(status);
  titleRef.current = title;
  descRef.current = description;
  statusRef.current = status;

  const saveCourse = useCallback(
    () =>
      start(async () => {
        await updateCourse(course.id, {
          title: titleRef.current,
          description: descRef.current || undefined,
          status: statusRef.current,
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 3000);
        router.refresh();
      }),
    [course.id, router],
  );

  const handleDeleteCourse = () => {
    start(async () => {
      await deleteCourse(course.id);
    });
  };

  const totalLessons = modules.reduce((sum, m) => sum + (lessonsByModule[m.id]?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Course header + details */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-brand-navy">Course Details</h1>
            {saveState === "saved" && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                ✓ Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
            >
              <option value="draft">📝 Draft</option>
              <option value="published">✅ Published</option>
            </select>
            <button
              onClick={saveCourse}
              disabled={pending}
              className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              Save course
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:text-brand-pink hover:border-brand-pink"
            >
              Delete
            </button>
          </div>
        </div>

        {confirmingDelete && (
          <div className="mb-4">
            <ConfirmBlock
              title={`Delete "${course.title}"?`}
              tone="destructive"
              confirmLabel="Delete course"
              pending={pending}
              onCancel={() => setConfirmingDelete(false)}
              onConfirm={handleDeleteCourse}
            >
              Removes the course, all {modules.length} module
              {modules.length !== 1 ? "s" : ""} and {totalLessons} lesson
              {totalLessons !== 1 ? "s" : ""}, plus every learner's progress against it. Cannot be
              undone.
            </ConfirmBlock>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1">Course title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-lg font-semibold focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="e.g., Foundations of Leadership"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="What will learners gain from this course? Write 2-3 sentences."
            />
          </div>
          <div className="text-xs pt-1">
            <span className="text-neutral-500">
              {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson
              {totalLessons !== 1 ? "s" : ""}
            </span>
            {status === "draft" && (
              <span className="ml-2 text-amber-600">
                · Draft — not visible to learners until published
              </span>
            )}
            {status === "published" && (
              <span className="ml-2 text-emerald-600">
                · Published — visible to learners in assigned cohorts
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-brand-navy">Modules & Lessons</h2>
        </div>

        {modules.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue-light">
              <span className="text-lg">📦</span>
            </div>
            <h3 className="font-semibold text-brand-navy">Add your first module</h3>
            <p className="mt-1 text-sm text-neutral-600 max-w-sm mx-auto">
              Modules are the major sections of your course (e.g., "Giving Feedback", "Running
              1:1s"). Each module contains individual lessons.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {modules.map((m, idx) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={idx}
                courseId={course.id}
                lessons={lessonsByModule[m.id] ?? []}
                pending={pending}
                onTransition={start}
                onRefresh={() => router.refresh()}
                onNavigate={(path) => router.push(path)}
              />
            ))}
          </div>
        )}

        <AddModuleForm
          courseId={course.id}
          pending={pending}
          onTransition={start}
          onRefresh={() => router.refresh()}
        />
      </div>
    </div>
  );
}

function ModuleCard({
  module: m,
  index,
  courseId,
  lessons,
  pending,
  onTransition,
  onRefresh,
  onNavigate,
}: {
  module: Module;
  index: number;
  courseId: string;
  lessons: Lesson[];
  pending: boolean;
  onTransition: (fn: () => Promise<void>) => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(m.title);
  const [editDesc, setEditDesc] = useState(m.description ?? "");
  const [editDuration, setEditDuration] = useState(m.duration_minutes?.toString() ?? "");
  const [addingLesson, setAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSaveModule = () => {
    onTransition(async () => {
      await updateModule(m.id, courseId, {
        title: editTitle,
        description: editDesc || undefined,
        duration_minutes: editDuration ? parseInt(editDuration, 10) : undefined,
      });
      setEditing(false);
      onRefresh();
    });
  };

  const handleDeleteModule = () => {
    onTransition(async () => {
      await deleteModule(m.id, courseId);
      setConfirmingDelete(false);
      onRefresh();
    });
  };

  const handleAddLesson = () => {
    if (!newLessonTitle.trim()) return;
    onTransition(async () => {
      const res = await createLesson(m.id, courseId, newLessonTitle);
      setNewLessonTitle("");
      setAddingLesson(false);
      if ("id" in res) onNavigate(`/super/course-builder/${courseId}/lessons/${res.id}`);
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Module header */}
      <div className="bg-brand-light px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              autoFocus
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="Module description — what will learners gain from this section? (optional)"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                Duration:
                <input
                  type="number"
                  min={0}
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="—"
                  className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
                min
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveModule}
                disabled={pending}
                className="rounded-md bg-brand-blue px-3 py-1 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-60"
              >
                Save module
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-neutral-500">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="cursor-pointer" onClick={() => setEditing(true)}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">MODULE {index + 1}</span>
                <h3 className="font-semibold text-brand-navy">{m.title}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="text-xs text-brand-blue hover:underline"
                >
                  Edit
                </button>
              </div>
              {m.description && <p className="text-sm text-neutral-600 mt-0.5">{m.description}</p>}
              <span className="text-xs text-neutral-500">
                {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                {m.duration_minutes ? ` · ${m.duration_minutes} min` : ""}
              </span>
            </div>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-neutral-400 hover:text-brand-pink ml-4"
            >
              Delete module
            </button>
          </div>
        )}
        {confirmingDelete && (
          <div className="mt-3">
            <ConfirmBlock
              title={`Delete "${m.title}"?`}
              tone="destructive"
              confirmLabel="Delete module"
              pending={pending}
              onCancel={() => setConfirmingDelete(false)}
              onConfirm={handleDeleteModule}
            >
              Removes this module and its {lessons.length} lesson
              {lessons.length !== 1 ? "s" : ""}. Cannot be undone.
            </ConfirmBlock>
          </div>
        )}
      </div>

      {/* Lessons list */}
      <div className="px-4 py-2">
        {lessons.length === 0 && !addingLesson ? (
          <p className="text-sm text-neutral-500 py-2">No lessons yet. Add one below.</p>
        ) : (
          <ul className="space-y-0.5 py-1">
            {lessons.map((l, lIdx) => (
              <li key={l.id}>
                <Link
                  href={`/super/course-builder/${courseId}/lessons/${l.id}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-brand-light transition group"
                >
                  <span className="text-xs text-neutral-400 w-4">{lIdx + 1}.</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${l.type === "quiz" ? "bg-brand-pink-light text-brand-pink" : "bg-brand-blue-light text-brand-blue"}`}
                  >
                    {l.type === "quiz" ? "Quiz" : "Lesson"}
                  </span>
                  <span className="text-brand-navy group-hover:text-brand-blue">{l.title}</span>
                  {/* Content indicators */}
                  <span className="ml-auto flex items-center gap-1.5">
                    {l.video_url && (
                      <span className="text-[10px] text-neutral-400" title="Has video">
                        ▶
                      </span>
                    )}
                    {hasContent(l.content) && (
                      <span className="text-[10px] text-neutral-400" title="Has written content">
                        ✎
                      </span>
                    )}
                    {!l.video_url && !hasContent(l.content) && (
                      <span className="text-[10px] text-amber-400" title="Empty — needs content">
                        ○
                      </span>
                    )}
                    <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100">
                      Edit →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Add lesson inline form */}
        {addingLesson ? (
          <div className="flex gap-2 py-2 border-t border-neutral-100">
            <input
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder="Lesson title..."
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddLesson();
                if (e.key === "Escape") setAddingLesson(false);
              }}
            />
            <button
              onClick={handleAddLesson}
              disabled={pending || !newLessonTitle.trim()}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              Create & edit
            </button>
            <button
              onClick={() => {
                setAddingLesson(false);
                setNewLessonTitle("");
              }}
              className="text-xs text-neutral-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingLesson(true)}
            className="w-full mt-1 rounded-md border border-dashed border-neutral-300 py-2 text-sm text-neutral-500 hover:border-brand-blue hover:text-brand-blue transition"
          >
            + Add lesson
          </button>
        )}
      </div>
    </div>
  );
}

function hasContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const doc = content as { type?: string; content?: Array<{ content?: unknown[] }> };
  if (doc.type !== "doc" || !doc.content) return false;
  // Check if there's any non-empty paragraph.
  return doc.content.some((node) => node.content && node.content.length > 0);
}

function AddModuleForm({
  courseId,
  pending,
  onTransition,
  onRefresh,
}: {
  courseId: string;
  pending: boolean;
  onTransition: (fn: () => Promise<void>) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const handleCreate = () => {
    if (!title.trim()) return;
    onTransition(async () => {
      await createModule(courseId, title);
      setTitle("");
      setOpen(false);
      onRefresh();
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-lg border-2 border-dashed border-neutral-300 py-4 text-sm font-medium text-neutral-500 hover:border-brand-blue hover:text-brand-blue transition"
      >
        + Add new module
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <label className="block text-sm font-medium text-brand-navy mb-1">New module title</label>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Giving Feedback That Lands"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button
          onClick={handleCreate}
          disabled={pending || !title.trim()}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          Create module
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
          className="text-sm text-neutral-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
