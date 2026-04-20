"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * LMS Phase D3 — learner-facing per-lesson notes + scroll-position resume.
 *
 * Notes are private by default (learner only) but readable by that
 * learner's coach / consultant / super via RLS. The big differentiator:
 * notes also feed `LearnerContext`, so the thought partner is aware of
 * what the learner flagged in real time.
 *
 * Scroll position is a single smallint 0..100 on `lesson_progress` so
 * the learner lands where they left off on return. Throttled client-
 * side; stamps fire-and-forget.
 */

const noteSchema = z.object({
  lessonId: z.string().uuid(),
  content: z.string().max(8000),
});

export async function upsertLessonNote(
  input: z.infer<typeof noteSchema>,
): Promise<{ ok: true } | { error: string }> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Empty notes delete the row rather than storing an empty string — keeps
  // the "recent notes" feed in LearnerContext clean.
  const trimmed = parsed.data.content.trim();
  if (trimmed.length === 0) {
    const { error } = await supabase
      .from("lesson_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", parsed.data.lessonId);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("lesson_notes").upsert(
    {
      user_id: user.id,
      lesson_id: parsed.data.lessonId,
      content: trimmed,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}

const scrollSchema = z.object({
  lessonId: z.string().uuid(),
  pct: z.number().int().min(0).max(100),
});

export async function stampScrollPosition(
  input: z.infer<typeof scrollSchema>,
): Promise<{ ok: true } | { error: string }> {
  const parsed = scrollSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Use the admin client so we can upsert without touching RLS on
  // lesson_progress (the row may not exist yet). Respects the user id from
  // the authenticated session — not a client-controlled param.
  const admin = createAdminClient();
  const { error } = await admin.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: parsed.data.lessonId,
      last_scroll_pct: parsed.data.pct,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}
