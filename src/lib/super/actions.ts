"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createOrg(name: string, slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").insert({ name, slug }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/super/orgs");
  return { ok: true, id: data.id };
}

export async function updateOrg(id: string, updates: { name?: string; slug?: string; logo_url?: string; status?: string }) {
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/super/orgs/${id}`);
  revalidatePath("/super/orgs");
  return { ok: true };
}

export async function assignCourseToCoho(cohortId: string, courseId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("cohort_courses").upsert({ cohort_id: cohortId, course_id: courseId }, { onConflict: "cohort_id,course_id" });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removeCourseFromCohort(cohortId: string, courseId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("cohort_courses").delete().eq("cohort_id", cohortId).eq("course_id", courseId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deletePost(postId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("community_posts").delete().eq("id", postId);
  if (error) return { error: error.message };
  revalidatePath("/super/moderation");
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("community_comments").delete().eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath("/super/moderation");
  return { ok: true };
}
