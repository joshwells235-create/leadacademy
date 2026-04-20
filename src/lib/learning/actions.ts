"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Course / module / lesson authoring actions — super-admin only. RLS on
 * these tables already restricts writes; the auth check here is defense
 * in depth plus a clean error message. Reorder uses a small "swap" move
 * keyed off the existing `order` column to avoid cascading re-numbers.
 */
async function requireSuperAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "Not authorized." };
  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function createCourse(title: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").insert({ title }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/super/course-builder");
  return { id: data.id };
}

export async function updateCourse(
  id: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    image_url?: string;
  },
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${id}`);
  revalidatePath("/super/course-builder");
  return { ok: true };
}

export async function deleteCourse(id: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/super/course-builder");
  redirect("/super/course-builder");
}

/**
 * Deep-clone a course with all its modules + lessons + quiz config.
 * Quiz attempts are NOT copied — those belong to the original course's
 * learners. Returns the new course id so the caller can navigate to it.
 */
export async function duplicateCourse(sourceId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { data: src } = await admin
    .from("courses")
    .select("title, description, status, image_url, order")
    .eq("id", sourceId)
    .maybeSingle();
  if (!src) return { error: "Course not found." };

  const { data: newCourse, error: newErr } = await admin
    .from("courses")
    .insert({
      title: `${src.title} (copy)`,
      description: src.description,
      status: "draft",
      image_url: src.image_url,
    })
    .select("id")
    .single();
  if (newErr || !newCourse) return { error: newErr?.message ?? "failed" };

  const { data: modules } = await admin
    .from("modules")
    .select("id, title, description, duration_minutes, order, status, learning_objectives")
    .eq("course_id", sourceId)
    .order("order");

  for (const m of modules ?? []) {
    const { data: newMod } = await admin
      .from("modules")
      .insert({
        course_id: newCourse.id,
        title: m.title,
        description: m.description,
        duration_minutes: m.duration_minutes,
        order: m.order,
        status: m.status,
        learning_objectives: m.learning_objectives,
      })
      .select("id")
      .single();
    if (!newMod) continue;

    const { data: lessons } = await admin
      .from("lessons")
      .select(
        "id, title, description, duration_minutes, type, content, video_url, materials, quiz, order",
      )
      .eq("module_id", m.id)
      .order("order");

    for (const l of lessons ?? []) {
      const { data: newLesson } = await admin
        .from("lessons")
        .insert({
          module_id: newMod.id,
          title: l.title,
          description: l.description,
          duration_minutes: l.duration_minutes,
          type: l.type,
          content: l.content,
          video_url: l.video_url,
          materials: l.materials,
          quiz: l.quiz,
          order: l.order,
        })
        .select("id")
        .single();
      if (!newLesson) continue;

      // Clone quiz settings + questions if this is a quiz lesson.
      if (l.type === "quiz") {
        const { data: settings } = await admin
          .from("quiz_settings")
          .select("*")
          .eq("lesson_id", l.id)
          .maybeSingle();
        if (settings) {
          await admin.from("quiz_settings").insert({
            lesson_id: newLesson.id,
            pass_percent: settings.pass_percent,
            max_attempts: settings.max_attempts,
            shuffle_questions: settings.shuffle_questions,
            show_correct_answers: settings.show_correct_answers,
            instructions: settings.instructions,
          });
        }
        const { data: questions } = await admin
          .from("quiz_questions")
          .select("type, prompt, explanation, points, order, config")
          .eq("lesson_id", l.id);
        if (questions && questions.length > 0) {
          await admin
            .from("quiz_questions")
            .insert(questions.map((q) => ({ ...q, lesson_id: newLesson.id })));
        }
      }

      // Clone linked resources.
      const { data: resourceLinks } = await admin
        .from("lesson_resources")
        .select("resource_id, order")
        .eq("lesson_id", l.id);
      if (resourceLinks && resourceLinks.length > 0) {
        await admin
          .from("lesson_resources")
          .insert(resourceLinks.map((r) => ({ ...r, lesson_id: newLesson.id })));
      }
    }
  }

  revalidatePath("/super/course-builder");
  return { id: newCourse.id };
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function createModule(courseId: string, title: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("modules")
    .select("order")
    .eq("course_id", courseId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;
  const { data, error } = await supabase
    .from("modules")
    .insert({ course_id: courseId, title, order: nextOrder })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { id: data.id };
}

export async function updateModule(
  id: string,
  courseId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    duration_minutes?: number | null;
    learning_objectives?: string[];
  },
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { error } = await supabase.from("modules").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

export async function deleteModule(id: string, courseId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { error } = await supabase.from("modules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

/**
 * Swap a module with its adjacent neighbor in either direction. "up"
 * trades with the module that has the next-lower order; "down" with
 * the next-higher. No-op at the ends.
 */
export async function moveModule(id: string, courseId: string, direction: "up" | "down") {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { data: self } = await admin.from("modules").select("id, order").eq("id", id).maybeSingle();
  if (!self) return { error: "Module not found." };

  const { data: neighbor } = await admin
    .from("modules")
    .select("id, order")
    .eq("course_id", courseId)
    [direction === "up" ? "lt" : "gt"]("order", self.order)
    .order("order", { ascending: direction !== "up" })
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true };

  await admin.from("modules").update({ order: -1 }).eq("id", self.id);
  await admin.from("modules").update({ order: self.order }).eq("id", neighbor.id);
  await admin.from("modules").update({ order: neighbor.order }).eq("id", self.id);

  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function createLesson(moduleId: string, courseId: string, title: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("lessons")
    .select("order")
    .eq("module_id", moduleId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;
  const { data, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId, title, order: nextOrder })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { id: data.id };
}

export async function updateLesson(
  id: string,
  courseId: string,
  updates: {
    title?: string;
    description?: string | null;
    duration_minutes?: number | null;
    content?: object;
    video_url?: string | null;
    type?: string;
    materials?: object;
  },
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.duration_minutes !== undefined)
    updateData.duration_minutes = updates.duration_minutes;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.video_url !== undefined) updateData.video_url = updates.video_url;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.materials !== undefined) updateData.materials = updates.materials;
  const { error } = await supabase
    .from("lessons")
    // biome-ignore lint/suspicious/noExplicitAny: runtime-shaped partial update
    .update(updateData as any)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}/lessons/${id}`);
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

export async function deleteLesson(id: string, courseId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

export async function moveLesson(
  id: string,
  moduleId: string,
  courseId: string,
  direction: "up" | "down",
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { data: self } = await admin.from("lessons").select("id, order").eq("id", id).maybeSingle();
  if (!self) return { error: "Lesson not found." };

  const { data: neighbor } = await admin
    .from("lessons")
    .select("id, order")
    .eq("module_id", moduleId)
    [direction === "up" ? "lt" : "gt"]("order", self.order)
    .order("order", { ascending: direction !== "up" })
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true };

  await admin.from("lessons").update({ order: -1 }).eq("id", self.id);
  await admin.from("lessons").update({ order: self.order }).eq("id", neighbor.id);
  await admin.from("lessons").update({ order: neighbor.order }).eq("id", self.id);

  revalidatePath(`/super/course-builder/${courseId}`);
  return { ok: true };
}

/**
 * Move a lesson to a different module. Puts it at the end of the target
 * module's lesson list. Caller supplies the current + target course ids
 * (they may differ — moving across courses is allowed).
 */
export async function moveLessonToModule(
  id: string,
  targetModuleId: string,
  sourceCourseId: string,
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { data: targetModule } = await admin
    .from("modules")
    .select("id, course_id")
    .eq("id", targetModuleId)
    .maybeSingle();
  if (!targetModule) return { error: "Target module not found." };

  const { data: existing } = await admin
    .from("lessons")
    .select("order")
    .eq("module_id", targetModuleId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;

  const { error } = await admin
    .from("lessons")
    .update({ module_id: targetModuleId, order: nextOrder })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/super/course-builder/${sourceCourseId}`);
  if (targetModule.course_id !== sourceCourseId)
    revalidatePath(`/super/course-builder/${targetModule.course_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lesson resources (link to the /super/resources library)
// ---------------------------------------------------------------------------

export async function linkLessonResource(lessonId: string, resourceId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("lesson_resources")
    .select("order")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;

  const { error } = await admin
    .from("lesson_resources")
    .upsert({ lesson_id: lessonId, resource_id: resourceId, order: nextOrder });
  if (error) return { error: error.message };

  const { data: lesson } = await admin
    .from("lessons")
    .select("module_id, modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const courseId = (lesson?.modules as unknown as { course_id: string } | null)?.course_id;
  if (courseId) revalidatePath(`/super/course-builder/${courseId}/lessons/${lessonId}`);

  return { ok: true };
}

export async function unlinkLessonResource(lessonId: string, resourceId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { error } = await admin
    .from("lesson_resources")
    .delete()
    .eq("lesson_id", lessonId)
    .eq("resource_id", resourceId);
  if (error) return { error: error.message };

  const { data: lesson } = await admin
    .from("lessons")
    .select("module_id, modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const courseId = (lesson?.modules as unknown as { course_id: string } | null)?.course_id;
  if (courseId) revalidatePath(`/super/course-builder/${courseId}/lessons/${lessonId}`);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cohort course assignment (super-admin)
// ---------------------------------------------------------------------------

export async function assignCourseToCoho(cohortId: string, courseId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cohort_courses")
    .upsert({ cohort_id: cohortId, course_id: courseId }, { onConflict: "cohort_id,course_id" });
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lesson progress (learner)
// ---------------------------------------------------------------------------

export async function markLessonComplete(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { error } = await supabase.from("lesson_progress").upsert({
    user_id: user.id,
    lesson_id: lessonId,
    completed: true,
    completed_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  return { ok: true };
}
