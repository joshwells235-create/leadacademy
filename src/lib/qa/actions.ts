"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateLessonAnswer } from "./answer";

/**
 * LMS Phase D4 — server actions for lesson-scoped questions.
 */

// ---------------------------------------------------------------------------
// Learner actions
// ---------------------------------------------------------------------------

const askSchema = z.object({
  lessonId: z.string().uuid(),
  question: z.string().trim().min(1).max(2000),
});

/**
 * Create a question row, synchronously generate the AI answer, and
 * return the completed row. Kept synchronous (no background job) so the
 * learner sees the answer the moment the button settles — the whole
 * "Ask the room" feel depends on that sub-2s response.
 */
export async function askLessonQuestion(
  input: z.infer<typeof askSchema>,
): Promise<{ ok: true; id: string; answer: string } | { error: string }> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Insert the row first so we have a stable id even if answer generation
  // later fails. Answer stays null until generateLessonAnswer returns.
  const { data: inserted, error: insertErr } = await supabase
    .from("lesson_questions")
    .insert({
      user_id: user.id,
      lesson_id: parsed.data.lessonId,
      question: parsed.data.question,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) return { error: insertErr?.message ?? "Failed to save question." };

  const answer = await generateLessonAnswer(supabase, {
    userId: user.id,
    lessonId: parsed.data.lessonId,
    question: parsed.data.question,
  });

  // Use admin client so the answer write doesn't need a fresh RLS check.
  const admin = createAdminClient();
  await admin
    .from("lesson_questions")
    .update({ ai_answer: answer, answered_at: new Date().toISOString() })
    .eq("id", inserted.id);

  return { ok: true, id: inserted.id, answer };
}

export async function flagQuestionToCoach(
  questionId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Confirm ownership via RLS-scoped select.
  const { data: row } = await supabase
    .from("lesson_questions")
    .select("id, user_id, flagged_to_coach_at, lesson_id, lessons(module_id, modules(course_id))")
    .eq("id", questionId)
    .maybeSingle();
  if (!row || row.user_id !== user.id) return { error: "Question not found." };
  if (row.flagged_to_coach_at) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("lesson_questions")
    .update({ flagged_to_coach_at: now })
    .eq("id", questionId);
  if (error) return { error: error.message };

  // Notify the active coach (if any) via the existing notifications table.
  const { data: assignment } = await supabase
    .from("coach_assignments")
    .select("coach_user_id")
    .eq("learner_user_id", user.id)
    .is("active_to", null)
    .limit(1)
    .maybeSingle();
  if (assignment?.coach_user_id) {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      user_id: assignment.coach_user_id,
      type: "coach_question_flagged",
      title: "A learner flagged a lesson question to you",
      body: "They got an AI answer but want a human take. Open their learner view to respond.",
      link: `/coach/learners/${user.id}#questions`,
    });
  }

  const courseId = (row.lessons as unknown as { modules: { course_id: string } | null } | null)
    ?.modules?.course_id;
  if (courseId) revalidatePath(`/learning/${courseId}/${row.lesson_id}`);
  return { ok: true };
}

export async function markQuestionResolved(
  questionId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("lesson_questions")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Coach action
// ---------------------------------------------------------------------------

const respondSchema = z.object({
  questionId: z.string().uuid(),
  response: z.string().trim().min(1).max(4000),
});

export async function coachRespondToQuestion(
  input: z.infer<typeof respondSchema>,
): Promise<{ ok: true } | { error: string }> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS restricts updates to coaches-of; we double-check to surface a
  // useful error message rather than a silent no-op.
  const { data: row } = await supabase
    .from("lesson_questions")
    .select("id, user_id, lesson_id, lessons(module_id, modules(course_id))")
    .eq("id", parsed.data.questionId)
    .maybeSingle();
  if (!row) return { error: "Question not found or not in your scope." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("lesson_questions")
    .update({
      coach_response: parsed.data.response,
      coach_responded_at: now,
      coach_user_id: user.id,
    })
    .eq("id", parsed.data.questionId);
  if (error) return { error: error.message };

  // Notify the learner.
  {
    const admin = createAdminClient();
    const courseId = (row.lessons as unknown as { modules: { course_id: string } | null } | null)
      ?.modules?.course_id;
    await admin.from("notifications").insert({
      user_id: row.user_id,
      type: "coach_question_answered",
      title: "Your coach answered your question",
      body: "Open the lesson to see their response.",
      link: courseId ? `/learning/${courseId}/${row.lesson_id}` : "/learning",
    });
  }

  revalidatePath(`/coach/learners/${row.user_id}`);
  const courseId = (row.lessons as unknown as { modules: { course_id: string } | null } | null)
    ?.modules?.course_id;
  if (courseId) revalidatePath(`/learning/${courseId}/${row.lesson_id}`);
  return { ok: true };
}
