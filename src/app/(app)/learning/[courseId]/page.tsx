import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ courseId: string }> };

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: course } = await supabase.from("courses").select("id, title, description").eq("id", courseId).maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase.from("modules").select("id, title, description, order, duration_minutes").eq("course_id", courseId).eq("status", "published").order("order");
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length > 0
    ? await supabase.from("lessons").select("id, module_id, title, type, order").in("module_id", moduleIds).order("order")
    : { data: [] };
  const { data: progress } = await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user!.id).eq("completed", true);
  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

  type LessonRow = { id: string; module_id: string; title: string; type: string; order: number };
  const lessonsByModule: Record<string, LessonRow[]> = {};
  for (const l of (lessons ?? []) as LessonRow[]) {
    if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
    lessonsByModule[l.module_id].push(l);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2 text-xs text-neutral-500">
        <Link href="/learning" className="hover:text-neutral-700">← All courses</Link>
      </div>
      <h1 className="text-2xl font-semibold text-brand-navy">{course.title}</h1>
      {course.description && <p className="mt-1 text-sm text-neutral-600">{course.description}</p>}

      <div className="mt-6 space-y-6">
        {(modules ?? []).map((m) => {
          const moduleLessons = lessonsByModule[m.id] ?? [];
          const done = moduleLessons.filter((l) => completedIds.has(l.id)).length;
          return (
            <div key={m.id} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-brand-navy">{m.title}</h2>
                  {m.description && <p className="mt-0.5 text-sm text-neutral-600">{m.description}</p>}
                </div>
                <span className="text-xs text-neutral-500">{done}/{moduleLessons.length}</span>
              </div>
              {moduleLessons.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2">
                  {moduleLessons.map((l) => (
                    <li key={l.id}>
                      <Link href={`/learning/${courseId}/${l.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brand-light transition">
                        <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center text-xs ${completedIds.has(l.id) ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300"}`}>
                          {completedIds.has(l.id) ? "✓" : ""}
                        </span>
                        <span className={completedIds.has(l.id) ? "text-neutral-500" : "text-brand-navy"}>{l.title}</span>
                        <span className={`ml-auto rounded px-1.5 py-0.5 text-xs ${l.type === "quiz" ? "bg-brand-pink-light text-brand-pink" : "bg-brand-blue-light text-brand-blue"}`}>{l.type}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
