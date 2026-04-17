import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseEditor } from "./course-editor";

type Props = { params: Promise<{ courseId: string }> };

export default async function CourseEditorPage({ params }: Props) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase.from("modules").select("id, title, description, status, order, duration_minutes").eq("course_id", courseId).order("order");

  // Get lesson counts per module.
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length > 0
    ? await supabase.from("lessons").select("id, module_id, title, type, order").in("module_id", moduleIds).order("order")
    : { data: [] };

  type LessonRow = { id: string; module_id: string; title: string; type: string; order: number };
  const lessonsByModule: Record<string, LessonRow[]> = {};
  for (const l of (lessons ?? []) as LessonRow[]) {
    if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
    lessonsByModule[l.module_id].push(l);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 text-xs text-neutral-500">
        <Link href="/super/course-builder" className="hover:text-neutral-700">← All courses</Link>
      </div>

      <CourseEditor course={course} modules={modules ?? []} lessonsByModule={lessonsByModule} />
    </div>
  );
}
