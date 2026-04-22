import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claude, MODELS } from "@/lib/ai/client";
import { buildCoachContext } from "@/lib/ai/context/build-coach-context";
import { buildLearnerContext } from "@/lib/ai/context/build-learner-context";
import { buildAttachmentParts } from "@/lib/ai/attachments/to-model-parts";
import { contentToUIParts } from "@/lib/ai/conversation/content-to-ui-parts";
import { generateConversationTitle } from "@/lib/ai/conversation/generate-title";
import { distillPendingConversations } from "@/lib/ai/memory/distill-pending";
import { estimateCostCents } from "@/lib/ai/pricing";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { ASSESSMENT_MODE } from "@/lib/ai/prompts/modes/assessment";
import { CAPSTONE_MODE } from "@/lib/ai/prompts/modes/capstone";
import { COACH_PARTNER_PROMPT } from "@/lib/ai/prompts/modes/coach-partner";
import { DEBRIEF_MODE } from "@/lib/ai/prompts/modes/debrief";
import { GENERAL_MODE } from "@/lib/ai/prompts/modes/general";
import { GOAL_MODE } from "@/lib/ai/prompts/modes/goal";
import { INTAKE_MODE } from "@/lib/ai/prompts/modes/intake";
import { REFLECTION_MODE } from "@/lib/ai/prompts/modes/reflection";
import { buildCreateReflectionTool } from "@/lib/ai/tools/create-reflection";
import { buildFinalizeGoalTool } from "@/lib/ai/tools/finalize-goal";
import { buildLogActionTool } from "@/lib/ai/tools/log-action";
import { buildLogCoachNoteTool } from "@/lib/ai/tools/log-coach-note";
import { buildRefineCapstoneSectionTool } from "@/lib/ai/tools/refine-capstone-section";
import { searchLessonsForLearner } from "@/lib/ai/tools/search-lessons";
import { buildSetDailyChallengeTool } from "@/lib/ai/tools/set-daily-challenge";
import { buildStartGoalSprintTool } from "@/lib/ai/tools/start-goal-sprint";
import { buildSuggestLessonTool } from "@/lib/ai/tools/suggest-lesson";
import { buildSuggestResourceTool } from "@/lib/ai/tools/suggest-resource";
import { buildTagThemesTool } from "@/lib/ai/tools/tag-themes";
import { buildUpdateGoalStatusTool } from "@/lib/ai/tools/update-goal-status";
import { buildUpdateProfileContextTool } from "@/lib/ai/tools/update-profile-context";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export const runtime = "nodejs";
export const maxDuration = 60;

const MODE_PROMPTS: Record<string, string> = {
  general: GENERAL_MODE,
  goal: GOAL_MODE,
  reflection: REFLECTION_MODE,
  assessment: ASSESSMENT_MODE,
  capstone: CAPSTONE_MODE,
  intake: INTAKE_MODE,
  debrief: DEBRIEF_MODE,
};

const requestSchema = z.object({
  messages: z.array(z.any()), // UIMessage[], validated by AI SDK
  mode: z
    .enum([
      "general",
      "goal",
      "reflection",
      "assessment",
      "capstone",
      "intake",
      "debrief",
      "coach_partner",
    ])
    .default("general"),
  conversationId: z.string().uuid().optional(),
  goalContext: z
    .object({
      primaryLens: z.enum(["self", "others", "org"]).optional(),
      goalId: z.string().uuid().optional(),
    })
    .optional(),
  // Attachment ids uploaded via /api/ai/chat/upload. The server joins
  // these rows onto the incoming user message so the TP sees them
  // this turn, and links them to the persisted message row via
  // message_id so replay rehydrates the chips.
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
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
    return NextResponse.json(
      { error: "bad request", details: parsed.error.format() },
      { status: 400 },
    );
  }
  const { messages } = parsed.data;
  let conversationId = parsed.data.conversationId;
  let mode = parsed.data.mode;
  let goalContext = parsed.data.goalContext;

  // Resume: trust the conversation's stored mode/context over what the client
  // sent, so a conversation started in goal mode stays there. Also verifies
  // ownership — RLS would reject otherwise, but we prefer a clean 404.
  if (conversationId) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id, mode, context_ref")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }
    if (
      existing.mode === "general" ||
      existing.mode === "goal" ||
      existing.mode === "reflection" ||
      existing.mode === "assessment" ||
      existing.mode === "capstone" ||
      existing.mode === "intake" ||
      existing.mode === "debrief" ||
      existing.mode === "coach_partner"
    ) {
      mode = existing.mode;
    }
    if (
      existing.context_ref &&
      typeof existing.context_ref === "object" &&
      !Array.isArray(existing.context_ref)
    ) {
      const ref = existing.context_ref as { primaryLens?: unknown; goalId?: unknown };
      const lens = ref.primaryLens;
      const goalId = ref.goalId;
      goalContext = {
        primaryLens: lens === "self" || lens === "others" || lens === "org" ? lens : undefined,
        goalId: typeof goalId === "string" ? goalId : undefined,
      };
    }
  } else {
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

    // Fire-and-forget: distill any idle, undistilled prior conversations now
    // that the learner has opened a new one. Naturally throttles by visit.
    void distillPendingConversations({
      userScoped: supabase,
      userId: user.id,
      orgId: membership.org_id,
    }).catch(() => {
      // Silent — distillation quality is a nice-to-have, not a blocker.
    });
  }

  // Attachment pipeline. If the client sent any attachmentIds, load the
  // rows, build the extra message parts (text blocks inlined, images +
  // PDFs sent as file/image parts with short-lived signed URLs), and
  // splice them into the latest user message BEFORE we hand it to
  // streamText. The same modified message is what we persist, so on
  // replay the transcript shows the text-attachment content inlined.
  // Image / PDF signed URLs in the persisted row will be stale on
  // replay — we rely on the ai_message_attachments row's message_id
  // link for reconstructing chips, not on URLs in the content JSON.
  const attachmentIds = parsed.data.attachmentIds ?? [];
  let attachmentRecords: Awaited<ReturnType<typeof buildAttachmentParts>>["records"] = [];
  let attachmentPrefix = "";
  let attachmentExtraParts: Awaited<ReturnType<typeof buildAttachmentParts>>["parts"] = [];
  if (attachmentIds.length > 0) {
    const built = await buildAttachmentParts(supabase, attachmentIds);
    attachmentPrefix = built.prefixText;
    attachmentExtraParts = built.parts;
    attachmentRecords = built.records;
  }

  // Persist the latest user message (it's the last in `messages`). When
  // there are attachments, prepend the text-attachment block(s) to the
  // user's own text so replay shows transcript content inline, and
  // append image/pdf parts so the immediate turn has them too.
  const latestUser = messages[messages.length - 1] as UIMessage | undefined;
  let persistedUserMessageId: string | null = null;
  if (latestUser?.role === "user") {
    const augmented = augmentUserMessageWithAttachments(
      latestUser,
      attachmentPrefix,
      attachmentExtraParts,
    );
    // Replace the in-memory last message so streamText sees attachments
    // this turn. `messages` is a local binding we can mutate.
    messages[messages.length - 1] = augmented as unknown as (typeof messages)[number];
    const { data: inserted } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: augmented as unknown as Json,
      })
      .select("id")
      .single();
    if (inserted?.id) {
      persistedUserMessageId = inserted.id;
    }
  }

  // Backfill the attachment rows with the persisted message id so the
  // replay flow can join chips back onto the right message. Also sets
  // conversation_id if the upload happened before the conversation
  // existed (i.e. first message of a new thread).
  if (persistedUserMessageId && attachmentRecords.length > 0) {
    await supabase
      .from("ai_message_attachments")
      .update({
        message_id: persistedUserMessageId,
        conversation_id: conversationId,
      })
      .in(
        "id",
        attachmentRecords.map((r) => r.id),
      )
      .eq("user_id", user.id);
  }

  // Coach-partner mode gets a different persona + context (talking TO the
  // coach, with caseload data) and a narrower tool set. All other modes use
  // the learner-facing persona + LearnerContext.
  const isCoachPartner = mode === "coach_partner";

  // If the coach-partner conversation is scoped to a specific coachee via
  // context_ref.learnerId, the coach context assembler renders a deep-dive
  // on that learner. Otherwise it renders a caseload overview.
  let coachScopedLearnerId: string | undefined;
  if (isCoachPartner && conversationId) {
    const { data: convo } = await supabase
      .from("ai_conversations")
      .select("context_ref")
      .eq("id", conversationId)
      .maybeSingle();
    if (
      convo?.context_ref &&
      typeof convo.context_ref === "object" &&
      !Array.isArray(convo.context_ref)
    ) {
      const v = (convo.context_ref as { learnerId?: unknown }).learnerId;
      if (typeof v === "string") coachScopedLearnerId = v;
    }
  }

  const contextBlock = isCoachPartner
    ? await buildCoachContext({
        supabase,
        coachUserId: user.id,
        learnerUserId: coachScopedLearnerId,
      })
    : await buildLearnerContext(supabase, user.id);

  const systemPrompt = isCoachPartner
    ? [
        COACH_PARTNER_PROMPT,
        `\n## Coach context (read-only, updated each turn)\n${contextBlock}`,
      ].join("\n")
    : [
        PERSONA,
        `\n## Current mode\n${MODE_PROMPTS[mode] ?? MODE_PROMPTS.general}`,
        `\n## Learner context (read-only, updated each turn)\n${contextBlock}`,
        goalContext?.primaryLens
          ? `\n## Starting lens\nThe learner started this conversation from the **${lensLabel(goalContext.primaryLens)}** lens. That's the on-ramp — the goal must still land with real impact across all three lenses. If calling finalize_goal, you can set primary_lens="${goalContext.primaryLens}" unless the learner clearly pivoted during the conversation.`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

  const todayIso = new Date().toISOString().slice(0, 10);

  // Build tools. `finalize_goal` writes to the DB with the learner's session.
  const finalizeGoalTool = buildFinalizeGoalTool(async (input) => {
    if (input.target_date && input.target_date < todayIso) {
      return {
        error: `target_date ${input.target_date} is in the past (today is ${todayIso}). Pick a future date and re-propose.`,
      };
    }
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

  // start_goal_sprint — close any active sprint on this goal and start a
  // new one. Approval-gated; this is a commitment moment.
  const startGoalSprintTool = buildStartGoalSprintTool(async (input) => {
    if (input.planned_end_date < todayIso) {
      return {
        error: `planned_end_date ${input.planned_end_date} is in the past (today is ${todayIso}). Sprints need a future end date — pick one 4-8 weeks out and re-propose.`,
      };
    }

    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", input.goal_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!goal) return { error: "goal not found" };

    const today = new Date().toISOString().slice(0, 10);

    // Close out any existing active sprint.
    await supabase
      .from("goal_sprints")
      .update({ status: "completed", actual_end_date: today })
      .eq("goal_id", input.goal_id)
      .eq("user_id", user.id)
      .eq("status", "active");

    // Compute next sprint_number.
    const { data: latest } = await supabase
      .from("goal_sprints")
      .select("sprint_number")
      .eq("goal_id", input.goal_id)
      .order("sprint_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (latest?.sprint_number ?? 0) + 1;

    const { data, error } = await supabase
      .from("goal_sprints")
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        goal_id: input.goal_id,
        title: input.title,
        practice: input.practice,
        planned_end_date: input.planned_end_date,
        sprint_number: nextNumber,
        status: "active",
      })
      .select("id, title, practice, planned_end_date, sprint_number")
      .single();
    if (error || !data) return { error: error?.message ?? "insert failed" };
    return {
      id: data.id,
      title: data.title,
      practice: data.practice,
      planned_end_date: data.planned_end_date,
      sprint_number: data.sprint_number,
    };
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

  // log_action — append a new action to /action-log. Auto-applied.
  // When the action is tied to a goal, stamp the goal's current active
  // sprint so the count can render against the sprint's progress signal.
  const logActionTool = buildLogActionTool(async (input) => {
    let sprintId: string | null = null;
    if (input.goal_id) {
      const { data: sprint } = await supabase
        .from("goal_sprints")
        .select("id")
        .eq("goal_id", input.goal_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      sprintId = sprint?.id ?? null;
    }

    const { data, error } = await supabase
      .from("action_logs")
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        description: input.description,
        goal_id: input.goal_id ?? null,
        sprint_id: sprintId,
        impact_area: input.impact_area ?? null,
        reflection: input.reflection ?? null,
        occurred_on: input.occurred_on ?? new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "insert failed" };
    return { id: data.id };
  });

  // create_reflection — save a new journal entry with themes. Auto-applied.
  const createReflectionTool = buildCreateReflectionTool(async (input) => {
    const { data, error } = await supabase
      .from("reflections")
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        content: input.content,
        themes: input.themes,
        reflected_on: input.reflected_on ?? new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "insert failed" };
    return { id: data.id };
  });

  // suggest_lesson — read-only search, scoped to learner's assigned courses.
  const suggestLessonTool = buildSuggestLessonTool(async (input) => {
    const lessons = await searchLessonsForLearner(supabase, user.id, input.query, 3);
    return { lessons };
  });

  // suggest_resource — read-only search against the global resource library.
  const suggestResourceTool = buildSuggestResourceTool(async (input) => {
    const term = input.query.trim().replace(/[%_]/g, (c) => `\\${c}`);
    const { data, error } = await supabase
      .from("resources")
      .select("id, title, description, category, type, url")
      .or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
      .limit(3);
    if (error) return { error: error.message };
    return { resources: data ?? [] };
  });

  // update_goal_status — flip status on one of the learner's goals. Approval.
  const updateGoalStatusTool = buildUpdateGoalStatusTool(async (input) => {
    const { data, error } = await supabase
      .from("goals")
      .update({ status: input.status })
      .eq("id", input.goal_id)
      .eq("user_id", user.id)
      .select("id, title, status")
      .single();
    if (error || !data) return { error: error?.message ?? "update failed" };
    return { id: data.id, title: data.title, status: data.status };
  });

  // update_profile_context — save intake-gathered profile fields to the
  // learner's profiles row. Auto-applied so the intake conversation
  // doesn't pile up approval pills; each save renders a small inline card
  // for transparency.
  const updateProfileContextTool = buildUpdateProfileContextTool(async (input) => {
    const updates: ProfileUpdate = {};
    const updatedFields: string[] = [];

    if (input.role_title !== undefined) {
      updates.role_title = input.role_title;
      updatedFields.push("role_title");
    }
    if (input.function_area !== undefined) {
      updates.function_area = input.function_area;
      updatedFields.push("function_area");
    }
    if (input.team_size !== undefined) {
      updates.team_size = input.team_size;
      updatedFields.push("team_size");
    }
    if (input.total_org_influence !== undefined) {
      updates.total_org_influence = input.total_org_influence;
      updatedFields.push("total_org_influence");
    }
    if (input.tenure_at_org !== undefined) {
      updates.tenure_at_org = input.tenure_at_org;
      updatedFields.push("tenure_at_org");
    }
    if (input.tenure_in_leadership !== undefined) {
      updates.tenure_in_leadership = input.tenure_in_leadership;
      updatedFields.push("tenure_in_leadership");
    }
    if (input.company_size !== undefined) {
      updates.company_size = input.company_size;
      updatedFields.push("company_size");
    }
    if (input.industry !== undefined) {
      updates.industry = input.industry;
      updatedFields.push("industry");
    }
    if (input.context_notes !== undefined) {
      updates.context_notes = input.context_notes;
      updatedFields.push("context_notes");
    }

    if (input.mark_complete) {
      updates.intake_completed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return { ok: true as const, updated_fields: [], marked_complete: false };
    }

    const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
    if (error) return { error: error.message };

    return {
      ok: true as const,
      updated_fields: updatedFields,
      marked_complete: !!input.mark_complete,
    };
  });

  // refine_capstone_section — merge a single capstone-outline section into
  // the learner's capstone_outlines row (creating the row on first save).
  // Approval-gated; the learner sees the proposed section before it lands.
  const refineCapstoneSectionTool = buildRefineCapstoneSectionTool(async (input) => {
    // Find the learner's cohort (nullable) to stamp on the row.
    const { data: cohortMembership } = await supabase
      .from("memberships")
      .select("cohort_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const { data: existing } = await supabase
      .from("capstone_outlines")
      .select("id, outline")
      .eq("user_id", user.id)
      .maybeSingle();

    const now = new Date().toISOString();
    type Section = {
      id: string;
      kind: string;
      heading: string;
      body: string;
      moments?: { title: string; description: string }[];
      pull_quotes?: { text: string; source: string }[];
      updated_at: string;
    };

    const newSection: Section = {
      id: crypto.randomUUID(),
      kind: input.kind,
      heading: input.heading,
      body: input.body,
      moments: input.moments,
      pull_quotes: input.pull_quotes,
      updated_at: now,
    };

    const outlineJson = (existing?.outline ?? {}) as {
      sections?: Section[];
      updated_by_ai_at?: string;
    };
    const prior = Array.isArray(outlineJson.sections) ? outlineJson.sections : [];
    const next = prior.filter((s) => s.kind !== input.kind);
    // Keep sections ordered by the canonical five-beat arc.
    const ORDER = ["before", "catalyst", "shift", "evidence", "what_next"];
    next.push(newSection);
    next.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

    const nextOutline = {
      ...outlineJson,
      sections: next,
      updated_by_ai_at: now,
    };

    if (existing) {
      const { error } = await supabase
        .from("capstone_outlines")
        .update({
          outline: nextOutline as unknown as Json,
          conversation_id: conversationId ?? null,
        })
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("capstone_outlines").insert({
        org_id: membership.org_id,
        user_id: user.id,
        cohort_id: cohortMembership?.cohort_id ?? null,
        conversation_id: conversationId ?? null,
        outline: nextOutline as unknown as Json,
        status: "draft",
      });
      if (error) return { error: error.message };
    }

    return { ok: true as const, kind: input.kind, heading: input.heading };
  });

  // set_daily_challenge — upsert today's or tomorrow's challenge. Approval.
  const setDailyChallengeTool = buildSetDailyChallengeTool(async (input) => {
    const now = new Date();
    if (input.for_date === "tomorrow") now.setDate(now.getDate() + 1);
    const forDate = now.toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from("daily_challenges")
      .select("id, challenge")
      .eq("user_id", user.id)
      .eq("for_date", forDate)
      .maybeSingle();

    if (existing && !input.replace_existing) {
      return {
        collision: true as const,
        existing_challenge: existing.challenge,
        for_date: forDate,
      };
    }

    if (existing) {
      const { data, error } = await supabase
        .from("daily_challenges")
        .update({
          challenge: input.challenge,
          completed: false,
          completed_at: null,
          reflection: null,
        })
        .eq("id", existing.id)
        .select("id, challenge, for_date")
        .single();
      if (error || !data) return { error: error?.message ?? "update failed" };
      return { id: data.id, challenge: data.challenge, for_date: data.for_date, replaced: true };
    }

    const { data, error } = await supabase
      .from("daily_challenges")
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        challenge: input.challenge,
        for_date: forDate,
      })
      .select("id, challenge, for_date")
      .single();
    if (error || !data) return { error: error?.message ?? "insert failed" };
    return { id: data.id, challenge: data.challenge, for_date: data.for_date, replaced: false };
  });

  // log_coach_note — coach-partner mode only. Writes a private note about
  // a specific coachee into `coach_notes`. Validates that the acting user
  // has an active coach_assignment against the learner_id — an RLS-safe
  // backstop beyond what policies already enforce.
  const logCoachNoteTool = buildLogCoachNoteTool(async (input) => {
    const { data: assignment } = await supabase
      .from("coach_assignments")
      .select("id")
      .eq("coach_user_id", user.id)
      .eq("learner_user_id", input.learner_id)
      .is("active_to", null)
      .maybeSingle();
    if (!assignment) {
      return { error: "not your coachee" };
    }
    const { data, error } = await supabase
      .from("coach_notes")
      .insert({
        org_id: membership.org_id,
        coach_user_id: user.id,
        learner_user_id: input.learner_id,
        content: input.content,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "insert failed" };
    const { data: learnerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", input.learner_id)
      .maybeSingle();
    return { id: data.id, learner_name: learnerProfile?.display_name ?? null };
  });

  // Strip any dangling tool-call parts — tool-* parts in assistant messages
  // that never received an output. These can happen when a learner types a
  // new message instead of clicking the approval pill's Apply/Dismiss buttons
  // on a needsApproval tool. Without this sanitizer, Anthropic rejects the
  // next call with "tool_use_id X is not followed by tool_result blocks"
  // and the conversation gets stuck. The AI re-proposes naturally on the
  // next turn if the user still wants the action.
  const sanitizedMessages = sanitizeDanglingToolParts(messages as UIMessage[]);
  const modelMessages = await convertToModelMessages(sanitizedMessages);

  // Coach-partner mode gets a narrower tool set — just log_coach_note for
  // Phase 2. The learner-facing tools write to the LEARNER's data; exposing
  // them here would let the coach's thought partner silently log actions or
  // finalize goals against a learner's record, which is a product-boundary
  // violation (the learner does that work, not the coach).
  const toolSet: ToolSet = isCoachPartner
    ? { log_coach_note: logCoachNoteTool }
    : {
        finalize_goal: finalizeGoalTool,
        tag_themes: tagThemesTool,
        log_action: logActionTool,
        create_reflection: createReflectionTool,
        suggest_lesson: suggestLessonTool,
        suggest_resource: suggestResourceTool,
        update_goal_status: updateGoalStatusTool,
        set_daily_challenge: setDailyChallengeTool,
        start_goal_sprint: startGoalSprintTool,
        refine_capstone_section: refineCapstoneSectionTool,
        update_profile_context: updateProfileContextTool,
      };

  const result = streamText({
    model: claude(model),
    system: systemPrompt,
    messages: modelMessages,
    tools: toolSet,
    stopWhen: stepCountIs(8), // Room for 2-3 tool calls + follow-up text per turn.
    onFinish: async (event) => {
      const latency = Date.now() - startedAt;
      const tokensIn = event.usage?.inputTokens ?? 0;
      const tokensOut = event.usage?.outputTokens ?? 0;

      const parts = contentToUIParts(event.content);
      const assistantContent = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        parts,
      };

      await supabase.from("ai_messages").insert({
        conversation_id: conversationId!,
        role: "assistant",
        content: assistantContent as unknown as Json,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: latency,
      });

      await supabase
        .from("ai_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId!);

      // Fire-and-forget title generation after the first exchange. We check
      // the DB for title/message-count rather than trusting the client's
      // view — avoids races with concurrent tabs.
      void (async () => {
        const { data: convo } = await supabase
          .from("ai_conversations")
          .select("title")
          .eq("id", conversationId!)
          .maybeSingle();
        if (!convo || convo.title) return;
        const { count } = await supabase
          .from("ai_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId!);
        if ((count ?? 0) !== 2) return;

        const userText = extractFirstUserText(latestUser);
        const assistantText = event.text?.trim() ?? "";
        if (!userText || !assistantText) return;

        const title = await generateConversationTitle({
          userMessage: userText,
          assistantMessage: assistantText,
        });
        if (!title) return;
        await supabase
          .from("ai_conversations")
          .update({ title })
          .eq("id", conversationId!)
          .is("title", null);
      })();

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

// Strip tool-* parts that Anthropic can't resolve on the next turn.
//
// Keep:
//   • output-available / output-error — the tool ran, Claude sees the result
//   • approval-responded / output-denied — the learner resolved the pill;
//     the approval response is what the model needs to continue the turn.
//     Stripping these (previous behavior) meant clicking "Save goal" did
//     nothing: the server received the approval in the request body but
//     filtered it out before handing it to the model.
//
// Strip:
//   • input-streaming / input-available — tool call with no input yet OR
//     no approval response yet. Leaving these in causes Anthropic to
//     reject the next call with "tool_use_id X is not followed by
//     tool_result blocks."
//   • approval-requested — approval request the learner walked away from
//     (typed a new message instead of clicking the pill). Same rejection
//     risk. The model re-proposes naturally on the next turn if the
//     learner still wants the action.
function sanitizeDanglingToolParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant") return m;
    const parts = (m as { parts?: unknown[] }).parts;
    if (!Array.isArray(parts)) return m;
    const cleaned = parts.filter((p) => {
      if (!p || typeof p !== "object") return true;
      const type = (p as { type?: unknown }).type;
      if (typeof type !== "string" || !type.startsWith("tool-")) return true;
      const state = (p as { state?: unknown }).state;
      return (
        state === "output-available" ||
        state === "output-error" ||
        state === "approval-responded" ||
        state === "output-denied"
      );
    });
    if (cleaned.length === parts.length) return m;
    return { ...m, parts: cleaned } as UIMessage;
  });
}

// Mutate-free merge of attachment content into a user UIMessage. Text
// attachment content goes at the top (as a new text part) so Claude
// reads the reference material before the learner's typed question;
// image/pdf parts go at the end. The returned shape is still a valid
// UIMessage — we keep the same `role`, `id`, and any other fields the
// caller sent; only `parts` changes.
function augmentUserMessageWithAttachments(
  msg: UIMessage,
  prefixText: string,
  extraParts: Awaited<ReturnType<typeof buildAttachmentParts>>["parts"],
): UIMessage {
  if (!prefixText && extraParts.length === 0) return msg;
  const existing = Array.isArray(msg.parts) ? msg.parts : [];
  const next: UIMessage["parts"] = [];
  if (prefixText) {
    next.push({ type: "text", text: prefixText } as UIMessage["parts"][number]);
  }
  for (const p of existing) next.push(p);
  for (const p of extraParts) {
    next.push(p as unknown as UIMessage["parts"][number]);
  }
  return { ...msg, parts: next };
}

function lensLabel(lens: "self" | "others" | "org"): string {
  return lens === "self"
    ? "Leading Self"
    : lens === "others"
      ? "Leading Others"
      : "Leading the Organization";
}

function extractFirstUserText(message: UIMessage | undefined): string {
  if (!message) return "";
  const parts = (message as { parts?: unknown[] }).parts;
  if (!Array.isArray(parts)) return "";
  for (const p of parts) {
    if (
      p &&
      typeof p === "object" &&
      (p as { type?: string }).type === "text" &&
      typeof (p as { text?: unknown }).text === "string"
    ) {
      return (p as { text: string }).text;
    }
  }
  return "";
}
