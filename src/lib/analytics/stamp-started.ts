import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fire-and-forget: stamp `lesson_progress.started_at` on a learner's
 * first visit to a lesson page. Idempotent — subsequent visits are a
 * no-op because we only update when the row is missing or started_at
 * is null.
 *
 * This is the foundation for Phase D drop-off + time-to-complete
 * analytics. Before this column, we could only measure who *finished*
 * — not who *started and stopped*.
 */
export async function stampLessonStarted(opts: {
  userId: string;
  lessonId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // Fast path: does a row already exist with started_at set? If yes,
    // stop. Cheaper than a blind upsert because it avoids the write
    // round-trip on every lesson re-visit.
    const { data: existing } = await admin
      .from("lesson_progress")
      .select("started_at, completed")
      .eq("user_id", opts.userId)
      .eq("lesson_id", opts.lessonId)
      .maybeSingle();

    if (existing?.started_at) return;

    // Upsert. Keep completed flag intact if the row existed (shouldn't,
    // but defensive) — set completed=false only when the row is new.
    await admin.from("lesson_progress").upsert(
      {
        user_id: opts.userId,
        lesson_id: opts.lessonId,
        started_at: new Date().toISOString(),
        completed: existing?.completed ?? false,
      },
      { onConflict: "user_id,lesson_id" },
    );
  } catch {
    // Swallow — analytics shouldn't block the lesson render.
  }
}
