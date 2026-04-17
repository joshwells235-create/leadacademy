import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { claude, MODELS } from "@/lib/ai/client";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { GENERAL_MODE } from "@/lib/ai/prompts/modes/general";
import { GOAL_MODE } from "@/lib/ai/prompts/modes/goal";
import { REFLECTION_MODE } from "@/lib/ai/prompts/modes/reflection";
import { buildFinalizeGoalTool } from "@/lib/ai/tools/finalize-goal";
import { buildTagThemesTool } from "@/lib/ai/tools/tag-themes";
import { buildLearnerContext } from "@/lib/ai/context/build-learner-context";
import { estimateCostCents } from "@/lib/ai/pricing";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODE_PROMPTS: Record<string, string> = {
  general: GENERAL_MODE,
  goal: GOAL_MODE,
  reflection: REFLECTION_MODE,
};

const requestSchema = z.object({
  messages: z.array(z.any()), // UIMessage[], validated by AI SDK
  mode: z.enum(["general", "goal", "reflection"]).default("general"),
  conversationId: z.string().uuid().optional(),
  goalContext: z
    .object({
      primaryLens: z.enum(["self", "others", "org"]).optional(),
      goalId: z.string().uuid().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Find the user's primary active membership for org scoping.
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "no active membership" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request", details: parsed.error.format() }, { status: 400 });
  }
  const { messages, mode, goalContext } = parsed.data;
  let conversationId = parsed.data.conversationId;

  // Create the conversation on first message.
  if (!conversationId) {
    const { data: convo, error } = await supabase
      .from("ai_conversations")
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        mode,
        context_ref: goalContext ?? {},
      })
      .select("id")
      .single();
    if (error || !convo) {
      return NextResponse.json(
        { error: "failed to create conversation", details: error?.message },
        { status: 500 },
      );
    }
    conversationId = convo.id;
  }

  // Persist the latest user message (it's the last in `messages`).
  const latestUser = messages[messages.length - 1] as UIMessage | undefined;
  if (latestUser?.role === "user") {
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: latestUser as unknown as Json,
    });
  }

  // Build the learner context — it goes on every turn so the coach stays grounded.
  const learnerContext = await buildLearnerContext(supabase, user.id);
  const systemPrompt = [
    PERSONA,
    "\n## Current mode\n" + (MODE_PROMPTS[mode] ?? MODE_PROMPTS.general),
    "\n## Learner context (read-only, updated each turn)\n" + learnerContext,
    goalContext?.primaryLens
      ? `\n## Starting lens\nThe learner started this conversation from the **${lensLabel(goalContext.primaryLens)}** lens. That's the on-ramp — the goal must still land with real impact across all three lenses. If calling finalize_goal, you can set primary_lens="${goalContext.primaryLens}" unless the learner clearly pivoted during the conversation.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Build tools. `finalize_goal` writes to the DB with the learner's session.
  const finalizeGoalTool = buildFinalizeGoalTool(async (input) => {
    const { data, error } = await supabase
      .from("goals")
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        primary_lens: input.primary_lens ?? goalContext?.primaryLens ?? null,
        title: input.title,
        smart_criteria: input.smart_criteria,
        impact_self: input.impact_self,
        impact_others: input.impact_others,
        impact_org: input.impact_org,
        target_date: input.target_date ?? null,
        status: "in_progress",
      })
      .select("id, title")
      .single();
    if (error || !data) {
      return { error: error?.message ?? "insert failed" };
    }
    return { id: data.id, title: data.title };
  });

  const startedAt = Date.now();
  const model = MODELS.sonnet;

  // tag_themes tool — updates a reflection's theme tags.
  const tagThemesTool = buildTagThemesTool(async (input) => {
    const { error } = await supabase
      .from("reflections")
      .update({ themes: input.themes })
      .eq("id", input.reflectionId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    return { ok: true };
  });

  const modelMessages = await convertToModelMessages(messages as UIMessage[]);
  const result = streamText({
    model: claude(model),
    system: systemPrompt,
    messages: modelMessages,
    tools: { finalize_goal: finalizeGoalTool, tag_themes: tagThemesTool },
    stopWhen: stepCountIs(4), // Allow one tool call + follow-up text.
    onFinish: async ({ usage, finishReason }) => {
      const latency = Date.now() - startedAt;
      const tokensIn = usage?.inputTokens ?? 0;
      const tokensOut = usage?.outputTokens ?? 0;

      // Persist assistant message + usage. We're in an async callback, so
      // we re-create the Supabase client with the user's cookies via a
      // service role client for a single atomic write.
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId!,
        role: "assistant",
        content: { finishReason } as unknown as Json,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: latency,
      });

      await supabase
        .from("ai_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId!);

      // Usage rollup — upsert per (user, day, model).
      const usdCents = estimateCostCents(model, tokensIn, tokensOut);
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from("ai_usage")
        .select("id, tokens_in, tokens_out, usd_cents, request_count")
        .eq("user_id", user.id)
        .eq("day", today)
        .eq("model", model)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("ai_usage")
          .update({
            tokens_in: existing.tokens_in + tokensIn,
            tokens_out: existing.tokens_out + tokensOut,
            usd_cents: existing.usd_cents + usdCents,
            request_count: existing.request_count + 1,
          })
          .eq("id", existing.id);
      } else {
        // Service role client can bypass RLS for the rollup insert (policies
        // only allow read). But for simplicity in Phase 1 we insert via RLS
        // context — the learner has no insert policy on ai_usage, so let's
        // use service role here.
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        await admin.from("ai_usage").insert({
          org_id: membership.org_id,
          user_id: user.id,
          day: today,
          model,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          usd_cents: usdCents,
          request_count: 1,
        });
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: { "x-conversation-id": conversationId },
  });
}

function lensLabel(lens: "self" | "others" | "org"): string {
  return lens === "self" ? "Leading Self" : lens === "others" ? "Leading Others" : "Leading the Organization";
}
