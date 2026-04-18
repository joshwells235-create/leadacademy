"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createPost(content: string, cohortId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!mem) return { error: "no membership" };

  const { error } = await supabase.from("community_posts").insert({
    org_id: mem.org_id,
    cohort_id: cohortId,
    user_id: user.id,
    content: content.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/community");
  return { ok: true };
}

export async function likePost(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  // Check if already liked.
  const { data: existing } = await supabase.from("community_likes").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();

  if (existing) {
    await supabase.from("community_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("community_likes").insert({ post_id: postId, user_id: user.id });
  }

  // Recount likes (simple and correct, avoids race conditions).
  const { count } = await supabase.from("community_likes").select("id", { count: "exact", head: true }).eq("post_id", postId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("community_posts").update({ likes_count: count ?? 0 } as any).eq("id", postId);

  revalidatePath("/community");
  return { ok: true, liked: !existing };
}

export async function createComment(postId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase.from("community_comments").insert({
    post_id: postId,
    user_id: user.id,
    content: content.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/community");
  return { ok: true };
}

export async function createResource(data: { title: string; description?: string; url: string; type: string; category?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase.from("resources").insert({
    title: data.title,
    description: data.description ?? null,
    url: data.url,
    type: data.type,
    category: data.category ?? null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/resources");
  return { ok: true };
}
