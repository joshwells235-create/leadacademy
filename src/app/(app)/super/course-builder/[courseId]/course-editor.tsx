"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCourse, deleteCourse, createModule, deleteModule, createLesson } from "@/lib/learning/actions";

type Course = { id: string; title: string; description: string | null; status: string };
type Module = { id: string; title: string; description: string | null; status: string; order: number; duration_minutes: number | null };
type Lesson = { id: string; module_id: string; title: string; type: string; order: number };

export function CourseEditor({ course, modules, lessonsByModule }: {
  course: Course;
  modules: Module[];
  lessonsByModule: Record<string, Lesson[] | undefined>;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [status, setStatus] = useState(course.status);
  const [pending, start] = useTransition();
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);
  const router = useRouter();

  const saveCourse = () => start(async () => {
    await updateCourse(course.id, { title, description: description || undefined, status });
    router.refresh();
  });

  const handleDeleteCourse = () => {
    if (!confirm("Delete this course and all its modules/lessons?")) return;
    start(async () => { await deleteCourse(course.id); });
  };

  const handleAddModule = () => {
    if (!newModuleTitle.trim()) return;
    start(async () => {
      await createModule(course.id, newModuleTitle);
      setNewModuleTitle("");
      setAddingModule(false);
      router.refresh();
    });
  };

  const handleDeleteModule = (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    start(async () => { await deleteModule(moduleId, course.id); router.refresh(); });
  };

  const handleAddLesson = (moduleId: string) => {
    const lessonTitle = prompt("Lesson title:");
    if (!lessonTitle?.trim()) return;
    start(async () => {
      const res = await createLesson(moduleId, course.id, lessonTitle);
      if ("id" in res) router.push(`/super/course-builder/${course.id}/lessons/${res.id}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Course details */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-brand-navy">Edit Course</h1>
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <button onClick={saveCourse} disabled={pending} className="rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark disabled:opacity-60">Save</button>
            <button onClick={handleDeleteCourse} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Delete</button>
          </div>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-lg font-semibold focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" placeholder="Course title" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" placeholder="Course description..." />
      </div>

      {/* Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brand-navy">Modules</h2>
          {!addingModule && (
            <button onClick={() => setAddingModule(true)} className="rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark">+ Add module</button>
          )}
        </div>

        {addingModule && (
          <div className="mb-3 flex gap-2">
            <input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="Module title..." className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" autoFocus />
            <button onClick={handleAddModule} disabled={pending} className="rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark disabled:opacity-60">Create</button>
            <button onClick={() => setAddingModule(false)} className="text-sm text-neutral-500">Cancel</button>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            No modules yet. Add one to start building lessons.
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((m) => {
              const moduleLessons = lessonsByModule[m.id] ?? [];
              return (
                <div key={m.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{m.title}</h3>
                      {m.description && <p className="text-sm text-neutral-600 mt-0.5">{m.description}</p>}
                      <span className="text-xs text-neutral-500">{moduleLessons.length} lesson{moduleLessons.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAddLesson(m.id)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">+ Lesson</button>
                      <button onClick={() => handleDeleteModule(m.id)} className="text-xs text-neutral-400 hover:text-brand-pink">Delete</button>
                    </div>
                  </div>
                  {moduleLessons.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2">
                      {moduleLessons.map((l) => (
                        <li key={l.id}>
                          <Link href={`/super/course-builder/${course.id}/lessons/${l.id}`} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-brand-light transition">
                            <span className={`rounded px-1.5 py-0.5 text-xs ${l.type === "quiz" ? "bg-brand-pink-light text-brand-pink" : "bg-brand-blue-light text-brand-blue"}`}>{l.type}</span>
                            {l.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
