"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const TENURE = ["<1y", "1-3y", "3-7y", "7y+"] as const;
const COMPANY_SIZE = ["solo", "<50", "50-250", "250-1k", "1k-5k", "5k+"] as const;

const profileSchema = z.object({
  role_title: z.string().min(1).max(200).optional().nullable(),
  function_area: z.string().min(1).max(200).optional().nullable(),
  team_size: z.number().int().min(0).max(10000).optional().nullable(),
  total_org_influence: z.number().int().min(0).max(1000000).optional().nullable(),
  tenure_at_org: z.enum(TENURE).optional().nullable(),
  tenure_in_leadership: z.enum(TENURE).optional().nullable(),
  company_size: z.enum(COMPANY_SIZE).optional().nullable(),
  industry: z.string().min(1).max(200).optional().nullable(),
  context_notes: z.string().max(4000).optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof profileSchema>;

/**
 * Save the full editable profile form. Also stamps intake_completed_at if
 * it wasn't already — the manual form counts as completing the intake so
 * we don't keep nagging on the dashboard.
 */
export async function updateProfile(input: UpdateProfileInput) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: existing } = await supabase
    .from("profiles")
    .select("intake_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const updates: ProfileUpdate = { ...parsed.data };
  if (!existing?.intake_completed_at) {
    updates.intake_completed_at = new Date().toISOString();
  }

  const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Clear intake_completed_at so the dashboard CTA reappears. Used when a
 * learner wants to re-run the intake conversation with their thought partner.
 */
export async function reopenIntake() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ intake_completed_at: null })
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
