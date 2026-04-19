"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Quiz authoring + submission actions. Questions live in `quiz_questions`;
 * settings in `quiz_settings` (one row per quiz lesson); learner attempts
 * in `quiz_attempts`. The question `config` JSONB column is shape-checked
 * here by Zod on write — we treat the DB as a dumb store and gate everything
 * in the action layer.
 */

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

// ---------------------------------------------------------------------------
// Quiz config shape
// ---------------------------------------------------------------------------

// Each question type has its own config shape — all merged into one union
// here so the author UI can persist any type through a single action.
const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
  feedback: z.string().trim().optional().default(""),
});

const singleChoiceSchema = z.object({
  options: z.array(optionSchema).min(2),
  correct_option_id: z.string().min(1),
});

const multiChoiceSchema = z.object({
  options: z.array(optionSchema).min(2),
  correct_option_ids: z.array(z.string().min(1)).min(1),
});

const trueFalseSchema = z.object({
  correct: z.boolean(),
  true_feedback: z.string().trim().optional().default(""),
  false_feedback: z.string().trim().optional().default(""),
});

const shortAnswerSchema = z.object({
  acceptable_answers: z.array(z.string().trim().min(1)).min(1),
  case_sensitive: z.boolean().default(false),
});

const matchingSchema = z.object({
  pairs: z
    .array(
      z.object({
        id: z.string().min(1),
        left: z.string().trim().min(1),
        right: z.string().trim().min(1),
      }),
    )
    .min(2),
});

const orderingSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), text: z.string().trim().min(1) })).min(2),
});

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "true_false"
  | "short_answer"
  | "matching"
  | "ordering";

function validateConfig(type: string, config: unknown): { ok: true } | { error: string } {
  const parsers: Record<QuestionType, z.ZodSchema> = {
    single_choice: singleChoiceSchema,
    multi_choice: multiChoiceSchema,
    true_false: trueFalseSchema,
    short_answer: shortAnswerSchema,
    matching: matchingSchema,
    ordering: orderingSchema,
  };
  const parser = parsers[type as QuestionType];
  if (!parser) return { error: `Unknown question type: ${type}` };
  const parsed = parser.safeParse(config);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid question config — check required fields.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  passPercent: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(100).nullable(),
  shuffleQuestions: z.boolean(),
  showCorrectAnswers: z.boolean(),
  instructions: z.string().trim().max(2000).optional().default(""),
});

export async function upsertQuizSettings(lessonId: string, input: z.infer<typeof settingsSchema>) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid settings." };

  const admin = createAdminClient();
  const { error } = await admin.from("quiz_settings").upsert(
    {
      lesson_id: lessonId,
      pass_percent: parsed.data.passPercent,
      max_attempts: parsed.data.maxAttempts,
      shuffle_questions: parsed.data.shuffleQuestions,
      show_correct_answers: parsed.data.showCorrectAnswers,
      instructions: parsed.data.instructions || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id" },
  );
  if (error) return { error: error.message };

  const { data: lesson } = await admin
    .from("lessons")
    .select("modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const courseId = (lesson?.modules as unknown as { course_id: string } | null)?.course_id;
  if (courseId) revalidatePath(`/super/course-builder/${courseId}/lessons/${lessonId}`);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function createQuizQuestion(
  lessonId: string,
  input: {
    type: QuestionType;
    prompt: string;
    explanation?: string;
    points: number;
    config: Record<string, unknown>;
  },
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  if (!input.prompt.trim()) return { error: "Prompt is required." };
  if (input.points < 1) return { error: "Points must be at least 1." };

  const validation = validateConfig(input.type, input.config);
  if ("error" in validation) return { error: validation.error };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("quiz_questions")
    .select("order")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.order ?? -1) + 1;

  const { data, error } = await admin
    .from("quiz_questions")
    .insert({
      lesson_id: lessonId,
      type: input.type,
      prompt: input.prompt.trim(),
      explanation: input.explanation?.trim() || null,
      points: input.points,
      order: nextOrder,
      config: input.config as never,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  return { ok: true, id: data.id };
}

export async function updateQuizQuestion(
  id: string,
  input: {
    type: QuestionType;
    prompt: string;
    explanation?: string;
    points: number;
    config: Record<string, unknown>;
  },
) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const validation = validateConfig(input.type, input.config);
  if ("error" in validation) return { error: validation.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("quiz_questions")
    .update({
      type: input.type,
      prompt: input.prompt.trim(),
      explanation: input.explanation?.trim() || null,
      points: input.points,
      config: input.config as never,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  return { ok: true };
}

export async function deleteQuizQuestion(id: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin.from("quiz_questions").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function moveQuizQuestion(id: string, direction: "up" | "down") {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();

  const { data: self } = await admin
    .from("quiz_questions")
    .select("id, order, lesson_id")
    .eq("id", id)
    .maybeSingle();
  if (!self) return { error: "Question not found." };

  const { data: neighbor } = await admin
    .from("quiz_questions")
    .select("id, order")
    .eq("lesson_id", self.lesson_id)
    [direction === "up" ? "lt" : "gt"]("order", self.order)
    .order("order", { ascending: direction !== "up" })
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true };

  await admin.from("quiz_questions").update({ order: -1 }).eq("id", self.id);
  await admin.from("quiz_questions").update({ order: self.order }).eq("id", neighbor.id);
  await admin.from("quiz_questions").update({ order: neighbor.order }).eq("id", self.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Grading helper (shared by submit + preview)
// ---------------------------------------------------------------------------

type Answer = { response: unknown };

function isCorrect(type: string, config: Record<string, unknown>, response: unknown): boolean {
  try {
    if (type === "single_choice") {
      return response === config.correct_option_id;
    }
    if (type === "multi_choice") {
      if (!Array.isArray(response)) return false;
      const correct = (config.correct_option_ids as string[]) ?? [];
      if (response.length !== correct.length) return false;
      const responseSet = new Set(response as string[]);
      return correct.every((id) => responseSet.has(id));
    }
    if (type === "true_false") {
      return response === config.correct;
    }
    if (type === "short_answer") {
      if (typeof response !== "string") return false;
      const acceptable = (config.acceptable_answers as string[]) ?? [];
      const caseSensitive = !!config.case_sensitive;
      return acceptable.some((a) => {
        if (caseSensitive) return a.trim() === response.trim();
        return a.trim().toLowerCase() === response.trim().toLowerCase();
      });
    }
    if (type === "matching") {
      if (typeof response !== "object" || response === null) return false;
      const pairs = (config.pairs as Array<{ id: string; right: string }>) ?? [];
      // response is { pairId: rightText }
      const responseMap = response as Record<string, string>;
      return pairs.every((p) => responseMap[p.id]?.trim() === p.right.trim());
    }
    if (type === "ordering") {
      if (!Array.isArray(response)) return false;
      const correctOrder = (config.items as Array<{ id: string }>) ?? [];
      if (response.length !== correctOrder.length) return false;
      return response.every((id, i) => id === correctOrder[i].id);
    }
  } catch {
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Learner submit
// ---------------------------------------------------------------------------

export async function submitQuizAttempt(
  lessonId: string,
  answers: Record<string, Answer>,
): Promise<
  | {
      ok: true;
      attemptId: string;
      scorePercent: number;
      scorePoints: number;
      maxPoints: number;
      passed: boolean;
      perQuestion: Record<
        string,
        { correct: boolean; points_earned: number; correct_answer?: unknown }
      >;
    }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const admin = createAdminClient();

  // Load settings + questions for this lesson. Use admin to bypass RLS
  // during grading (we trust the caller is the learner we just auth'd).
  const { data: settingsRow } = await admin
    .from("quiz_settings")
    .select("pass_percent, max_attempts")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  const passPercent = settingsRow?.pass_percent ?? 80;
  const maxAttempts = settingsRow?.max_attempts ?? null;

  const { data: questions } = await admin
    .from("quiz_questions")
    .select("id, type, points, config")
    .eq("lesson_id", lessonId)
    .order("order");

  if (!questions || questions.length === 0) {
    return { error: "Quiz has no questions." };
  }

  // Enforce attempt cap.
  const { count: previousAttempts } = await admin
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId)
    .eq("user_id", user.id)
    .not("completed_at", "is", null);

  if (maxAttempts !== null && (previousAttempts ?? 0) >= maxAttempts) {
    return { error: `No attempts remaining (max ${maxAttempts}).` };
  }

  const { data: lesson } = await admin
    .from("lessons")
    .select("modules(course_id, courses(id))")
    .eq("id", lessonId)
    .maybeSingle();
  // Best-effort: resolve the learner's org for attribution via their
  // active membership (covers the common single-org case).
  const { data: membership } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  let scorePoints = 0;
  let maxPoints = 0;
  const perQuestion: Record<
    string,
    { correct: boolean; points_earned: number; correct_answer?: unknown }
  > = {};
  const storedAnswers: Record<string, unknown> = {};

  for (const q of questions) {
    maxPoints += q.points;
    const given = answers[q.id]?.response;
    const correct = isCorrect(q.type, q.config as Record<string, unknown>, given);
    const earned = correct ? q.points : 0;
    scorePoints += earned;
    perQuestion[q.id] = {
      correct,
      points_earned: earned,
      correct_answer:
        (q.config as Record<string, unknown>).correct_option_id ??
        (q.config as Record<string, unknown>).correct_option_ids ??
        (q.config as Record<string, unknown>).correct ??
        undefined,
    };
    storedAnswers[q.id] = { response: given, correct, points_earned: earned };
  }

  const scorePercent =
    maxPoints === 0
      ? 0
      : Math.round(((scorePoints / maxPoints) * 100 + Number.EPSILON) * 100) / 100;
  const passed = scorePercent >= passPercent;

  const attemptNumber = (previousAttempts ?? 0) + 1;
  const { data: attempt, error: insertErr } = await admin
    .from("quiz_attempts")
    .insert({
      lesson_id: lessonId,
      user_id: user.id,
      org_id: membership?.org_id ?? null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      answers: storedAnswers as never,
      score_points: scorePoints,
      max_points: maxPoints,
      score_percent: scorePercent,
      passed,
      attempt_number: attemptNumber,
    })
    .select("id")
    .single();
  if (insertErr || !attempt) return { error: insertErr?.message ?? "Attempt save failed." };

  // On pass → mark lesson complete. On fail → learner can retry if
  // attempts remain.
  if (passed) {
    await admin.from("lesson_progress").upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    });
  }

  const courseId = (lesson?.modules as unknown as { course_id?: string } | null)?.course_id;
  if (courseId) {
    revalidatePath(`/learning/${courseId}/${lessonId}`);
    revalidatePath(`/learning/${courseId}`);
  }

  return {
    ok: true,
    attemptId: attempt.id,
    scorePercent,
    scorePoints,
    maxPoints,
    passed,
    perQuestion,
  };
}
