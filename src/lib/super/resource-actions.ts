"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  url: z.string().trim().url(),
  type: z.string().trim().min(1).max(40),
  category: z.string().trim().max(40).optional().nullable(),
});

export async function createResource(input: z.infer<typeof resourceSchema>) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("resources")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      url: parsed.data.url,
      type: parsed.data.type,
      category: parsed.data.category?.trim() || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: ctx.userId,
    action: "super.resource.created",
    target_type: "resource",
    target_id: data.id,
    details: { title: parsed.data.title } as never,
  });

  revalidatePath("/super/resources");
  return { ok: true, id: data.id };
}

export async function updateResource(resourceId: string, input: z.infer<typeof resourceSchema>) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("resources")
    .update({
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      url: parsed.data.url,
      type: parsed.data.type,
      category: parsed.data.category?.trim() || null,
    })
    .eq("id", resourceId);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: ctx.userId,
    action: "super.resource.updated",
    target_type: "resource",
    target_id: resourceId,
    details: { title: parsed.data.title } as never,
  });

  revalidatePath("/super/resources");
  return { ok: true };
}

export async function deleteResource(resourceId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: res } = await admin
    .from("resources")
    .select("title")
    .eq("id", resourceId)
    .maybeSingle();

  const { error } = await admin.from("resources").delete().eq("id", resourceId);
  if (error) return { error: error.message };

  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: ctx.userId,
    action: "super.resource.deleted",
    target_type: "resource",
    target_id: resourceId,
    details: { title: res?.title ?? null } as never,
  });

  revalidatePath("/super/resources");
  return { ok: true };
}
