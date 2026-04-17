"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createReflectionSchema = z.object({
  content: z.string().min(1).max(10000),
  reflectedOn: z.string().optional(), // YYYY-MM-DD
});

export type CreateReflectionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]>; reflectionId?: undefined }
  | { status: "success"; message: string; reflectionId: string };

export async function createReflection(
  _prev: CreateReflectionState,
  formData: FormData,
): Promise<CreateReflectionState> {
  const parsed = createReflectionSchema.safeParse({
    content: formData.get("content"),
    reflectedOn: formData.get("reflectedOn") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "not signed in" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { status: "error", message: "no active membership" };

  const { data, error } = await supabase
    .from("reflections")
    .insert({
      user_id: user.id,
      org_id: membership.org_id,
      content: parsed.data.content,
      reflected_on: parsed.data.reflectedOn ?? new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "insert failed" };
  }

  revalidatePath("/reflections");
  revalidatePath("/dashboard");
  return { status: "success", message: "Reflection saved.", reflectionId: data.id };
}

export async function completeDailyChallenge(challengeId: string, reflection?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_challenges")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      reflection: reflection ?? null,
    })
    .eq("id", challengeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
