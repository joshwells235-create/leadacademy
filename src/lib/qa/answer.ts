import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { assembleLearnerContext } from "@/lib/ai/context/assemble";
import { formatLearnerContext } from "@/lib/ai/context/format";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import type { Database, Json } from "@/lib/types/database";

/**
 * LMS Phase D4 — answer a lesson-scoped question with the thought
 * partner's voice, grounded in both the lesson body and the learner's
 * full context.
 *
 * This is NOT a full conversation — it's a single grounded answer.
 * Learners who want to go deeper can move to the chat surface via
 * the "Keep talking" affordance in the UI.
 *
 * The answer should:
 * - Draw primarily from the lesson's own content when the question is
 *   about the material ("what did the author mean by X?").
 * - Draw from the learner's context when the question is applied
 *   ("how does this land for my situation?").
 * - Be honest when the lesson doesn't directly answer the question.
 * - End with one pointed question if there's a natural next step, or
 *   a suggestion to flag-to-coach if the learner's still stuck.
 */

const FALLBACK_ANSWER =
  "I'm having trouble generating a grounded answer right now. If this is a real stuck point, flag it to your coach below and they'll follow up.";

export async function generateLessonAnswer(
  supabase: SupabaseClient<Database>,
  args: {
    userId: string;
    lessonId: string;
    question: string;
  },
): Promise<string> {
  // Pull the lesson body (Tiptap JSON), plus its course title for framing.
  const { data: lessonRow } = await supabase
    .from("lessons")
    .select(
      "id, title, description, content, type, module_id, modules(title, course_id, courses(title))",
    )
    .eq("id", args.lessonId)
    .maybeSingle();

  const lessonTitle = lessonRow?.title ?? "this lesson";
  const modules = lessonRow?.modules as unknown as {
    title: string;
    courses: { title: string } | { title: string }[] | null;
  } | null;
  const courseTitle = (() => {
    if (!modules?.courses) return null;
    if (Array.isArray(modules.courses)) return modules.courses[0]?.title ?? null;
    return modules.courses.title;
  })();
  const moduleTitle = modules?.title ?? null;
  const lessonDescription = lessonRow?.description ?? null;
  const lessonBodyPreview = extractTiptapText(lessonRow?.content as Json | null);

  // Full learner context — same the chat surface uses.
  const ctx = await assembleLearnerContext(supabase, args.userId);
  const contextBlock = formatLearnerContext(ctx);

  const systemPrompt = [
    PERSONA,
    "",
    "## What you're doing right now",
    "The learner asked ONE question from inside a lesson page. They want a single grounded answer, not a conversation. Keep it short — 3 to 6 sentences, or one short paragraph plus one brief follow-up question if a follow-up would actually help them move forward.",
    "",
    "Ground your answer in:",
    "1. The lesson content below (when the question is about the material).",
    "2. The learner's context (when the question is applied to their own situation).",
    "",
    "If the lesson content doesn't clearly answer the question and the learner's context doesn't give you enough to ground a real answer, SAY SO. Don't fabricate. In that case, suggest they flag the question to their coach (there's a button right below this in the UI).",
    "",
    "Don't use bullet points. Don't open with 'Great question'. Don't sign off with 'Let me know if that helps'. Answer the question.",
    "",
    "## Lesson context",
    `Title: ${lessonTitle}`,
    moduleTitle ? `Module: ${moduleTitle}` : null,
    courseTitle ? `Course: ${courseTitle}` : null,
    lessonDescription ? `Description: ${lessonDescription}` : null,
    "",
    "Lesson body (extracted text):",
    lessonBodyPreview || "(This lesson has no written content — it may be video- or quiz-only.)",
    "",
    "## Learner context (read-only)",
    contextBlock,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system: systemPrompt,
      prompt: `Learner's question:\n\n${args.question.trim()}\n\nAnswer now. No preamble.`,
      maxOutputTokens: 600,
    });
    const text = result.text.trim();
    return text.length > 0 ? text : FALLBACK_ANSWER;
  } catch {
    return FALLBACK_ANSWER;
  }
}

/**
 * Lightweight Tiptap-JSON → text extraction so we can include the
 * lesson body in the system prompt without pulling in the full HTML
 * generator (which we already learned drags in happy-dom on Vercel).
 * Preserves paragraph breaks; skips images + iframes + other non-text
 * nodes. Capped at 6000 chars to keep system-prompt size sane.
 */
function extractTiptapText(doc: Json | null): string {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "";
  const parts: string[] = [];
  const maxChars = 6000;
  let charCount = 0;
  const walk = (node: unknown) => {
    if (charCount >= maxChars) return;
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string" && n.text.length > 0) {
      parts.push(n.text);
      charCount += n.text.length;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
      // Add a paragraph break after container-level nodes.
      if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") {
        parts.push("\n");
        charCount += 1;
      }
    }
  };
  walk(doc);
  const full = parts.join("").trim();
  if (full.length <= maxChars) return full;
  return `${full.slice(0, maxChars)}…`;
}
