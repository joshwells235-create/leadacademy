"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

// --- Courses (super-admin) ---
export async function createCourse(title: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").insert({ title }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/super/course-builder");
  return { id: data.id };
}

export async function updateCourse(id: string, updates: { title?: string; description?: string; status?: string; image_url?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${id}`);
  revalidatePath("/super/course-builder");
  return { ok: true };
}

export async function deleteCourse(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/super/course-builder");
  redirect("/super/course-builder");
}

// --- Modules (super-admin) ---
export async function createModule(courseId: string, title: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("modules").select("order").eq("course_id", courseId).order("order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;
  const { data, error } = await supabase.from("modules").insert({ course_id: courseId, title, order: nextOrder }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { id: data.id };
}

export async function updateModule(id: string, courseId: string, updates: { title?: string; description?: string; status?: string; duration_minutes?: number }) {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

export async function deleteModule(id: string, courseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

// --- Lessons (super-admin) ---
export async function createLesson(moduleId: string, courseId: string, title: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("lessons").select("order").eq("module_id", moduleId).order("order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;
  const { data, error } = await supabase.from("lessons").insert({ module_id: moduleId, title, order: nextOrder }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { id: data.id };
}

export async function updateLesson(id: string, courseId: string, updates: { title?: string; content?: object; video_url?: string | null; type?: string; materials?: object }) {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.video_url !== undefined) updateData.video_url = updates.video_url;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.materials !== undefined) updateData.materials = updates.materials;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("lessons").update(updateData as any).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}/lessons/${id}`);
  return { ok: true };
}

export async function deleteLesson(id: string, courseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

// --- Cohort course assignment (super-admin) ---
export async function assignCourseToCoho(cohortId: string, courseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cohort_courses").upsert({ cohort_id: cohortId, course_id: courseId }, { onConflict: "cohort_id,course_id" });
  if (error) return { error: error.message };
  return { ok: true };
}

// --- Lesson progress (learner) ---
export async function markLessonComplete(lessonId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { error } = await supabase.from("lesson_progress").upsert({
    user_id: user.id,
    lesson_id: lessonId,
    completed: true,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id,lesson_id" });
  if (error) return { error: error.message };
  revalidatePath("/learning");
  return { ok: true };
}
