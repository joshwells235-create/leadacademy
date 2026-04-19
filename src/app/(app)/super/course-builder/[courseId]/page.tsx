import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseEditor } from "./course-editor";

type Props = { params: Promise<{ courseId: string }> };

export default async function CourseEditorPage({ params }: Props) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, description, status, order, duration_minutes, learning_objectives")
    .eq("course_id", courseId)
    .order("order");

  // Get lesson counts per module.
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } =
    moduleIds.length > 0
      ? await supabase
          .from("lessons")
          .select(
            "id, module_id, title, description, duration_minutes, type, order, video_url, content",
          )
          .in("module_id", moduleIds)
          .order("order")
      : { data: [] };

  type LessonRow = {
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    type: string;
    order: number;
    video_url: string | null;
    content: unknown;
  };
  const lessonsByModule: Record<string, LessonRow[]> = {};
  for (const l of (lessons ?? []) as LessonRow[]) {
    if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
    lessonsByModule[l.module_id].push(l);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/course-builder" className="hover:text-brand-blue">
          Courses
        </Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{course.title}</span>
      </nav>

      <CourseEditor course={course} modules={modules ?? []} lessonsByModule={lessonsByModule} />
    </div>
  );
}
