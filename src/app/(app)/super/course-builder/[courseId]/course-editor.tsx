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
  duplicateCourse,
  moveLesson,
  moveModule,
  updateCourse,
  updateModule,
} from "@/lib/learning/actions";

type Course = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cert_validity_months?: number | null;
};
type Module = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  duration_minutes: number | null;
  learning_objectives: string[] | null;
};
type Lesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
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
  const [certValidity, setCertValidity] = useState<string>(
    course.cert_validity_months ? String(course.cert_validity_months) : "",
  );
  const [pending, start] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const router = useRouter();

  const titleRef = useRef(title);
  const descRef = useRef(description);
  const statusRef = useRef(status);
  const certValidityRef = useRef(certValidity);
  titleRef.current = title;
  descRef.current = description;
  statusRef.current = status;
  certValidityRef.current = certValidity;

  const saveCourse = useCallback(
    () =>
      start(async () => {
        const raw = certValidityRef.current.trim();
        const months = raw === "" ? null : Number.parseInt(raw, 10);
        await updateCourse(course.id, {
          title: titleRef.current,
          description: descRef.current || undefined,
          status: statusRef.current,
          cert_validity_months: Number.isFinite(months as number) ? months : null,
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

  const handleDuplicate = () => {
    setDupError(null);
    setDuplicating(true);
    start(async () => {
      const res = await duplicateCourse(course.id);
      setDuplicating(false);
      if ("error" in res && res.error) {
        setDupError(res.error);
        return;
      }
      if ("id" in res && res.id) {
        router.push(`/super/course-builder/${res.id}`);
      }
    });
  };

  const totalLessons = modules.reduce((sum, m) => sum + (lessonsByModule[m.id]?.length ?? 0), 0);
  const totalDuration = modules.reduce(
    (sum, m) =>
      sum +
      (m.duration_minutes ??
        (lessonsByModule[m.id] ?? []).reduce((s, l) => s + (l.duration_minutes ?? 0), 0)),
    0,
  );
  const emptyModules = modules.filter((m) => (lessonsByModule[m.id]?.length ?? 0) === 0);

  return (
    <div className="space-y-6">
      {/* Course header + details */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-brand-navy">Course Details</h1>
            {saveState === "saved" && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                ✓ Saved
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
            >
              <option value="draft">📝 Draft</option>
              <option value="published">✅ Published</option>
            </select>
            <button
              type="button"
              onClick={saveCourse}
              disabled={pending}
              className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              Save course
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={pending || duplicating}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60"
              title="Create a draft copy of this course with all modules and lessons"
            >
              {duplicating ? "Duplicating…" : "Duplicate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:text-brand-pink hover:border-brand-pink"
            >
              Delete
            </button>
          </div>
        </div>

        {dupError && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {dupError}
          </p>
        )}

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

        {status === "published" && emptyModules.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Heads up: {emptyModules.length} module
            {emptyModules.length === 1 ? " has" : "s have"} no lessons yet —{" "}
            {emptyModules.map((m) => `"${m.title}"`).join(", ")}. Learners will see empty section
            {emptyModules.length === 1 ? "" : "s"}.
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
          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1">
              Certificate validity
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={600}
                value={certValidity}
                onChange={(e) => setCertValidity(e.target.value)}
                placeholder="Non-expiring"
                className="w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
              <span className="text-xs text-neutral-500">
                months — leave blank for non-expiring
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              When a learner completes this course, a certificate is issued automatically. If set,
              the certificate expires after this many months and the learner can re-complete to
              renew.
            </p>
          </div>
          <div className="text-xs pt-1">
            <span className="text-neutral-500">
              {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson
              {totalLessons !== 1 ? "s" : ""}
              {totalDuration > 0 && ` · ~${totalDuration} min total`}
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
                isFirst={idx === 0}
                isLast={idx === modules.length - 1}
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
  isFirst,
  isLast,
  courseId,
  lessons,
  pending,
  onTransition,
  onRefresh,
  onNavigate,
}: {
  module: Module;
  index: number;
  isFirst: boolean;
  isLast: boolean;
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
  const [editObjectives, setEditObjectives] = useState((m.learning_objectives ?? []).join("\n"));
  const [addingLesson, setAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveModule = () => {
    setSaveState("idle");
    setSaveError(null);
    onTransition(async () => {
      const objectives = editObjectives
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await updateModule(m.id, courseId, {
        title: editTitle,
        description: editDesc || undefined,
        duration_minutes: editDuration ? Number.parseInt(editDuration, 10) : null,
        learning_objectives: objectives,
      });
      if ("error" in res && res.error) {
        setSaveState("error");
        setSaveError(res.error);
        return;
      }
      setSaveState("saved");
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

  const handleMove = (direction: "up" | "down") => {
    onTransition(async () => {
      await moveModule(m.id, courseId, direction);
      onRefresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
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
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                Learning objectives (one per line)
              </label>
              <textarea
                value={editObjectives}
                onChange={(e) => setEditObjectives(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                placeholder={
                  "Give feedback without creating defensiveness\nRun a 1:1 that surfaces what matters"
                }
              />
            </div>
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
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveModule}
                disabled={pending}
                className="rounded-md bg-brand-blue px-3 py-1 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-60"
              >
                Save module
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-neutral-500"
              >
                Cancel
              </button>
              {saveState === "error" && saveError && (
                <span className="text-xs text-red-700">{saveError}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">MODULE {index + 1}</span>
                <h3 className="font-semibold text-brand-navy">{m.title}</h3>
                {saveState === "saved" && (
                  <span className="text-[10px] text-emerald-700">✓ Saved</span>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-brand-blue hover:underline"
                >
                  Edit
                </button>
              </div>
              {m.description && <p className="text-sm text-neutral-600 mt-0.5">{m.description}</p>}
              {m.learning_objectives && m.learning_objectives.length > 0 && (
                <ul className="mt-1 text-[11px] text-neutral-500 list-disc pl-4">
                  {m.learning_objectives.slice(0, 3).map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                  {m.learning_objectives.length > 3 && (
                    <li className="list-none text-neutral-400">
                      +{m.learning_objectives.length - 3} more
                    </li>
                  )}
                </ul>
              )}
              <span className="text-xs text-neutral-500">
                {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                {m.duration_minutes ? ` · ${m.duration_minutes} min` : ""}
                {lessons.length === 0 && (
                  <span className="ml-2 text-amber-600">· Empty — add a lesson</span>
                )}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleMove("up")}
                  disabled={isFirst || pending}
                  title="Move module up"
                  className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs text-neutral-500 hover:text-brand-blue hover:border-brand-blue disabled:opacity-30"
                  aria-label="Move module up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMove("down")}
                  disabled={isLast || pending}
                  title="Move module down"
                  className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs text-neutral-500 hover:text-brand-blue hover:border-brand-blue disabled:opacity-30"
                  aria-label="Move module down"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-neutral-400 hover:text-brand-pink"
              >
                Delete
              </button>
            </div>
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
              <LessonRow
                key={l.id}
                lesson={l}
                index={lIdx}
                isFirst={lIdx === 0}
                isLast={lIdx === lessons.length - 1}
                courseId={courseId}
                moduleId={m.id}
                pending={pending}
                onTransition={onTransition}
                onRefresh={onRefresh}
              />
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
              type="button"
              onClick={handleAddLesson}
              disabled={pending || !newLessonTitle.trim()}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              Create & edit
            </button>
            <button
              type="button"
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
            type="button"
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

function LessonRow({
  lesson: l,
  index,
  isFirst,
  isLast,
  courseId,
  moduleId,
  pending,
  onTransition,
  onRefresh,
}: {
  lesson: Lesson;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  courseId: string;
  moduleId: string;
  pending: boolean;
  onTransition: (fn: () => Promise<void>) => void;
  onRefresh: () => void;
}) {
  const handleMove = (direction: "up" | "down") => {
    onTransition(async () => {
      await moveLesson(l.id, moduleId, courseId, direction);
      onRefresh();
    });
  };

  return (
    <li className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-brand-light transition">
      <div className="flex flex-col gap-0 items-center shrink-0">
        <button
          type="button"
          onClick={() => handleMove("up")}
          disabled={isFirst || pending}
          aria-label="Move lesson up"
          className="text-[10px] leading-none text-neutral-400 hover:text-brand-blue disabled:opacity-30 px-1"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => handleMove("down")}
          disabled={isLast || pending}
          aria-label="Move lesson down"
          className="text-[10px] leading-none text-neutral-400 hover:text-brand-blue disabled:opacity-30 px-1"
        >
          ↓
        </button>
      </div>
      <Link
        href={`/super/course-builder/${courseId}/lessons/${l.id}`}
        className="flex flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-sm"
      >
        <span className="text-xs text-neutral-400 w-4">{index + 1}.</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            l.type === "quiz"
              ? "bg-brand-pink-light text-brand-pink"
              : "bg-brand-blue-light text-brand-blue"
          }`}
        >
          {l.type === "quiz" ? "Quiz" : "Lesson"}
        </span>
        <span className="text-brand-navy group-hover:text-brand-blue truncate">{l.title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {l.duration_minutes ? (
            <span className="text-[10px] text-neutral-400">{l.duration_minutes} min</span>
          ) : null}
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
          {!l.video_url && !hasContent(l.content) && l.type !== "quiz" && (
            <span className="text-[10px] text-amber-400" title="Empty — needs content">
              ○
            </span>
          )}
          <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100">Edit →</span>
        </span>
      </Link>
    </li>
  );
}

function hasContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const doc = content as { type?: string; content?: Array<{ content?: unknown[] }> };
  if (doc.type !== "doc" || !doc.content) return false;
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
        type="button"
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
          type="button"
          onClick={handleCreate}
          disabled={pending || !title.trim()}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          Create module
        </button>
        <button
          type="button"
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
