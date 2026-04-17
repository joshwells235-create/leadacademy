import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonEditorWrapper } from "./lesson-editor-wrapper";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function LessonEditorPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: lesson } = await supabase.from("lessons").select("id, title, type, content, video_url, materials, quiz, module_id, order").eq("id", lessonId).maybeSingle();
  if (!lesson) notFound();

  // Fetch context: course name, module name, sibling lessons for prev/next nav.
  const [courseRes, modRes, siblingsRes] = await Promise.all([
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("title").eq("id", lesson.module_id).maybeSingle(),
    supabase.from("lessons").select("id, title, order").eq("module_id", lesson.module_id).order("order"),
  ]);

  const siblings = siblingsRes.data ?? [];
  const currentIdx = siblings.findIndex((s) => s.id === lessonId);
  const prevLesson = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextLesson = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/course-builder" className="hover:text-brand-blue">Courses</Link>
        <span>/</span>
        <Link href={`/super/course-builder/${courseId}`} className="hover:text-brand-blue">
          {courseRes.data?.title ?? "Course"}
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{modRes.data?.title ?? "Module"}</span>
        <span>/</span>
        <span className="font-medium text-brand-navy">{lesson.title}</span>
      </nav>

      <LessonEditorWrapper
        lesson={lesson}
        courseId={courseId}
        prevLesson={prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null}
        nextLesson={nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null}
      />
    </div>
  );
}
