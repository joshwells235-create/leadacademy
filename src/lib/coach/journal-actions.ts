"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  themes: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type JournalActionResult =
  | { ok: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

export async function createJournalEntry(
  _prev: JournalActionResult | null,
  formData: FormData,
): Promise<JournalActionResult> {
  const rawThemes = formData.get("themes");
  const themes =
    typeof rawThemes === "string"
      ? rawThemes
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const parsed = createSchema.safeParse({
    content: formData.get("content"),
    themes,
    entryDate: formData.get("entryDate") || undefined,
  });
  if (!parsed.success) {
    return {
      error: "Check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Must be a coach somewhere. The RLS policy enforces this via
  // is_coach_in_org; the explicit check gives a friendlier error than
  // a raw RLS denial.
  const { data: coachMembership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "coach")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!coachMembership) return { error: "Only coaches can write journal entries." };

  const { error } = await supabase.from("coach_journal_entries").insert({
    coach_user_id: user.id,
    org_id: coachMembership.org_id,
    content: parsed.data.content,
    themes: parsed.data.themes ?? [],
    entry_date: parsed.data.entryDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };

  revalidatePath("/coach/journal");
  return { ok: true };
}

export async function deleteJournalEntry(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS blocks cross-coach deletes; this explicit ownership check just
  // gives a clearer error if the row doesn't exist for this coach.
  const { data: row } = await supabase
    .from("coach_journal_entries")
    .select("id")
    .eq("id", id)
    .eq("coach_user_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Entry not found." };

  const { error } = await supabase.from("coach_journal_entries").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/coach/journal");
  return { ok: true };
}
