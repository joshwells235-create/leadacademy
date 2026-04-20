"use server";

import { generateText } from "ai";
import { redirect } from "next/navigation";
import { claude, MODELS } from "@/lib/ai/client";
import { assembleLearnerContext } from "@/lib/ai/context/assemble";
import { formatLearnerContext } from "@/lib/ai/context/format";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { DEBRIEF_MODE } from "@/lib/ai/prompts/modes/debrief";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const FALLBACK =
  "You just finished the course. Before you move on — what's one specific thing from it that landed for you, and where in your current leadership life is it going to show up?";

/**
 * LMS Phase D2 — completion debrief.
 *
 * Invoked from the course-complete celebration banner. Creates a new
 * `debrief`-mode conversation, generates an opener grounded in the
 * specific course they just finished (title, quiz results, their own
 * reflections during the course window), persists it as the first
 * assistant message, and redirects into the chat.
 *
 * Mirrors `startAssessmentDebrief` — same opener-synthesis pattern,
 * same seeded-conversation contract.
 */
export async function startCourseDebrief(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  // Idempotency: if a debrief conversation for this course already exists
  // and is recent (≤30 days), resume it instead of spawning a duplicate.
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id, last_message_at, created_at")
    .eq("user_id", user.id)
    .eq("mode", "debrief")
    .contains("context_ref", { courseId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const anchor = existing.last_message_at ?? existing.created_at;
    if (anchor && Date.now() - new Date(anchor).getTime() < 30 * 24 * 60 * 60 * 1000) {
      redirect(`/coach-chat?c=${existing.id}`);
    }
  }

  // Load course + the learner's completion evidence for this course so the
  // opener can reference specifics. "First completed_at" across this
  // course's lessons is when they effectively finished it.
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) redirect(`/learning/${courseId}`);

  const { data: modules } = await supabase.from("modules").select("id").eq("course_id", courseId);
  const moduleIds = (modules ?? []).map((m) => m.id);

  type CourseLesson = { id: string; title: string; type: string | null };
  let courseLessons: CourseLesson[] = [];
  if (moduleIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, type")
      .in("module_id", moduleIds);
    courseLessons = (lessons ?? []) as CourseLesson[];
  }

  const lessonIds = courseLessons.map((l) => l.id);
  const quizLessonIds = courseLessons.filter((l) => l.type === "quiz").map((l) => l.id);

  // Any quiz attempts (pass-rate + first-try signal for the opener).
  let quizSignals: string[] = [];
  if (quizLessonIds.length > 0) {
    const { data: quizAttempts } = await supabase
      .from("quiz_attempts")
      .select("lesson_id, passed, score_percent, attempt_number")
      .eq("user_id", user.id)
      .in("lesson_id", quizLessonIds)
      .order("attempt_number", { ascending: true });
    if (quizAttempts && quizAttempts.length > 0) {
      const titleById = new Map(courseLessons.map((l) => [l.id, l.title]));
      const byLesson = new Map<string, { first: number | null; passedFirst: boolean }>();
      for (const a of quizAttempts) {
        const entry = byLesson.get(a.lesson_id as string) ?? {
          first: null,
          passedFirst: false,
        };
        if (entry.first === null) {
          entry.first = a.score_percent ?? null;
          entry.passedFirst = a.passed === true;
        }
        byLesson.set(a.lesson_id as string, entry);
      }
      for (const [lid, e] of byLesson) {
        const title = titleById.get(lid) ?? "(quiz)";
        quizSignals.push(
          `Quiz "${title}": first attempt ${e.passedFirst ? "passed" : "did not pass"}${
            e.first !== null ? ` (${e.first}%)` : ""
          }`,
        );
      }
    }
  }
  if (quizSignals.length === 0) quizSignals = ["No quizzes in this course."];

  // Completion window — first started_at → last completed_at across this
  // course. Gives the opener a "you just wrapped" sense of timing.
  let completionWindow = "";
  if (lessonIds.length > 0) {
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("started_at, completed_at, completed")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);
    const starts = (progress ?? [])
      .map((p) => (p.started_at ? Date.parse(p.started_at) : null))
      .filter((t): t is number => t !== null);
    const completions = (progress ?? [])
      .filter((p) => p.completed && p.completed_at)
      .map((p) => Date.parse(p.completed_at as string));
    if (starts.length > 0 && completions.length > 0) {
      const firstStart = new Date(Math.min(...starts));
      const lastComplete = new Date(Math.max(...completions));
      const days = Math.max(
        1,
        Math.round((lastComplete.getTime() - firstStart.getTime()) / (1000 * 60 * 60 * 24)),
      );
      completionWindow = `You started this course ${firstStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} and completed the last lesson ${lastComplete.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} — ${days} day${days === 1 ? "" : "s"} of work.`;
    }
  }

  const { data: convo, error: convoError } = await supabase
    .from("ai_conversations")
    .insert({
      org_id: membership.org_id,
      user_id: user.id,
      mode: "debrief",
      context_ref: { courseId } as unknown as Json,
    })
    .select("id")
    .single();
  if (convoError || !convo) redirect(`/learning/${courseId}`);

  const learnerContext = formatLearnerContext(await assembleLearnerContext(supabase, user.id));
  const systemPrompt = [
    PERSONA,
    `\n## Current mode\n${DEBRIEF_MODE}`,
    `\n## Learner context (read-only, updated each turn)\n${learnerContext}`,
    "",
    "## Course they just finished",
    `Title: ${course.title}`,
    course.description ? `Description: ${course.description}` : null,
    completionWindow ? completionWindow : null,
    "",
    "Performance signals in this course:",
    ...quizSignals.map((s) => `- ${s}`),
    "",
    "## Opener task",
    "You're writing the OPENING message of a brand-new debrief conversation. The learner just clicked \"Debrief with thought partner\" from the course-complete banner. They haven't said anything yet.",
    "",
    "Your opener must:",
    `- Open by naming the course they finished ("${course.title}") and one *specific* thing from their broader context it connects to (an active sprint, a recent reflection theme, a goal they've been working, a memory fact, an assessment theme). Use their own language if you have it.`,
    "- Keep it warm and grounded, not celebratory or gamified. No 'Congrats!' or 'Well done!'.",
    "- End with ONE open question that invites them into the 'what landed' beat. Something like 'what from it is sticking with you?' but more specific to their context.",
    "- Total length under 70 words. Plain language. No bullet points.",
    "- Don't quiz them, don't recap the course, don't list takeaways. They took the course; you don't need to teach it back.",
    "- Do NOT call tools on this first turn.",
  ]
    .filter(Boolean)
    .join("\n");

  let openerText: string;
  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt:
        "Write the opening message for this course debrief now. Ground it in the course + their broader context. No preamble, no sign-off.",
      maxOutputTokens: 400,
    });
    openerText = result.text.trim();
  } catch {
    openerText = FALLBACK;
  }
  if (!openerText) openerText = FALLBACK;

  const assistantContent = {
    id: crypto.randomUUID(),
    role: "assistant" as const,
    parts: [{ type: "text", text: openerText }],
  };

  await supabase.from("ai_messages").insert({
    conversation_id: convo.id,
    role: "assistant",
    content: assistantContent as unknown as Json,
    model: MODELS.sonnet,
  });

  await supabase
    .from("ai_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", convo.id);

  redirect(`/coach-chat?c=${convo.id}`);
}
