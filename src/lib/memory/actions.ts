"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MEMORY_CONFIDENCES, MEMORY_TYPES } from "@/lib/ai/memory/types";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

const addSchema = z.object({
  type: z.enum(MEMORY_TYPES),
  content: z.string().trim().min(1).max(2000),
  confidence: z.enum(MEMORY_CONFIDENCES).default("high"),
});

const updateSchema = z.object({
  id: idSchema,
  type: z.enum(MEMORY_TYPES),
  content: z.string().trim().min(1).max(2000),
  confidence: z.enum(MEMORY_CONFIDENCES),
});

export async function addMemoryFact(input: unknown) {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "no active membership" };

  const { error } = await supabase.from("learner_memory").insert({
    org_id: membership.org_id,
    user_id: user.id,
    type: parsed.data.type,
    content: parsed.data.content,
    confidence: parsed.data.confidence,
    edited_by_user: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/memory");
  return { ok: true };
}

export async function updateMemoryFact(input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("learner_memory")
    .update({
      type: parsed.data.type,
      content: parsed.data.content,
      confidence: parsed.data.confidence,
      edited_by_user: true,
      last_seen: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/memory");
  return { ok: true };
}

export async function setProactivityEnabled(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ proactivity_enabled: enabled })
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/memory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMemoryFact(id: string) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "bad id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  // Tombstone rather than hard delete — prevents distillation from
  // re-adding the same fact next turn.
  const { error } = await supabase
    .from("learner_memory")
    .update({ deleted_by_user: true })
    .eq("id", parsed.data)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/memory");
  return { ok: true };
}
