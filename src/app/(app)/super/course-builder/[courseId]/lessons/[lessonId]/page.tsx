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

  const { data: lesson } = await supabase.from("lessons").select("id, title, type, content, video_url, materials, quiz, module_id").eq("id", lessonId).maybeSingle();
  if (!lesson) notFound();

  const { data: mod } = await supabase.from("modules").select("title").eq("id", lesson.module_id).maybeSingle();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 text-xs text-neutral-500">
        <Link href={`/super/course-builder/${courseId}`} className="hover:text-neutral-700">
          ← Back to course
        </Link>
        {mod && <span className="mx-1">/</span>}
        {mod && <span>{mod.title}</span>}
      </div>

      <LessonEditorWrapper lesson={lesson} courseId={courseId} />
    </div>
  );
}
