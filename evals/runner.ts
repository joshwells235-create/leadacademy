import { generateText, stepCountIs } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { formatLearnerContext } from "@/lib/ai/context/format";
import type { LearnerContext } from "@/lib/ai/context/types";
import { PERSONA } from "@/lib/ai/prompts/base/persona";
import { ASSESSMENT_MODE } from "@/lib/ai/prompts/modes/assessment";
import { CAPSTONE_MODE } from "@/lib/ai/prompts/modes/capstone";
import { GENERAL_MODE } from "@/lib/ai/prompts/modes/general";
import { GOAL_MODE } from "@/lib/ai/prompts/modes/goal";
import { REFLECTION_MODE } from "@/lib/ai/prompts/modes/reflection";
import { buildCreateReflectionTool } from "@/lib/ai/tools/create-reflection";
import { buildFinalizeGoalTool } from "@/lib/ai/tools/finalize-goal";
import { buildLogActionTool } from "@/lib/ai/tools/log-action";
import { buildRefineCapstoneSectionTool } from "@/lib/ai/tools/refine-capstone-section";
import { buildSetDailyChallengeTool } from "@/lib/ai/tools/set-daily-challenge";
import { buildStartGoalSprintTool } from "@/lib/ai/tools/start-goal-sprint";
import { buildSuggestLessonTool } from "@/lib/ai/tools/suggest-lesson";
import { buildSuggestResourceTool } from "@/lib/ai/tools/suggest-resource";
import { buildTagThemesTool } from "@/lib/ai/tools/tag-themes";
import { buildUpdateGoalStatusTool } from "@/lib/ai/tools/update-goal-status";
import type { Fixture, RunnerOutput, ToolCallCapture } from "./types";

const MODE_PROMPTS: Record<Fixture["mode"], string> = {
  general: GENERAL_MODE,
  goal: GOAL_MODE,
  reflection: REFLECTION_MODE,
  assessment: ASSESSMENT_MODE,
  capstone: CAPSTONE_MODE,
};

const EMPTY_CONTEXT: LearnerContext = {
  identity: {
    name: "the learner",
    timezone: null,
    organization: null,
    cohort: null,
    role: null,
  },
  assessments: {},
  assessmentCombinedThemes: [],
  goals: [],
  recentActions: [],
  reflections: [],
  lastSessionRecap: null,
  openActionItems: [],
  mostRecentCompletedActionItem: null,
  courseProgress: null,
  dailyChallenge: {
    todayChallenge: null,
    todayCompleted: false,
    completedLast7Days: 0,
    totalLast7Days: 0,
  },
  memoryFacts: [],
};

/**
 * Merge a fixture's partial context into the empty default — anything the
 * fixture doesn't specify falls back to empty. This mirrors the real
 * `assembleLearnerContext` output shape so the formatter produces real-looking
 * prompt text.
 */
function buildContext(partial: Fixture["context"]): LearnerContext {
  return {
    ...EMPTY_CONTEXT,
    ...partial,
    identity: { ...EMPTY_CONTEXT.identity, ...(partial.identity ?? {}) },
    dailyChallenge: { ...EMPTY_CONTEXT.dailyChallenge, ...(partial.dailyChallenge ?? {}) },
    assessments: partial.assessments ?? {},
    assessmentCombinedThemes: partial.assessmentCombinedThemes ?? [],
    goals: partial.goals ?? [],
    recentActions: partial.recentActions ?? [],
    reflections: partial.reflections ?? [],
    openActionItems: partial.openActionItems ?? [],
    memoryFacts: partial.memoryFacts ?? [],
  };
}

function buildSystemPrompt(fixture: Fixture): string {
  const context = buildContext(fixture.context);
  const contextText = formatLearnerContext(context);
  const lens = fixture.goalContext?.primaryLens;
  return [
    PERSONA,
    `\n## Current mode\n${MODE_PROMPTS[fixture.mode]}`,
    `\n## Learner context (read-only, updated each turn)\n${contextText}`,
    lens
      ? `\n## Starting lens\nThe learner started this conversation from the **${lensLabel(lens)}** lens. If calling finalize_goal, you can set primary_lens="${lens}" unless the learner clearly pivoted during the conversation.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function lensLabel(lens: "self" | "others" | "org"): string {
  return lens === "self"
    ? "Leading Self"
    : lens === "others"
      ? "Leading Others"
      : "Leading the Organization";
}

/**
 * Build the tool set with eval-safe mock handlers. Handlers record their
 * input and return a plausible success response so auto-applied tools can
 * continue the turn naturally. Approval-gated tools won't reach their
 * handler in-run — their proposal is captured via content parts regardless.
 */
function buildEvalTools() {
  const record: ToolCallCapture[] = [];

  const rememberStatic = (name: string, input: unknown, needsApproval = false) => {
    record.push({
      toolName: name,
      toolCallId: `eval-${record.length}`,
      input,
      needsApproval,
    });
  };

  const tools = {
    finalize_goal: buildFinalizeGoalTool(async (input) => {
      rememberStatic("finalize_goal", input, true);
      return { id: "eval-goal-id", title: input.title };
    }),
    tag_themes: buildTagThemesTool(async (input) => {
      rememberStatic("tag_themes", input);
      return { ok: true };
    }),
    log_action: buildLogActionTool(async (input) => {
      rememberStatic("log_action", input);
      return { id: "eval-action-id" };
    }),
    create_reflection: buildCreateReflectionTool(async (input) => {
      rememberStatic("create_reflection", input);
      return { id: "eval-reflection-id" };
    }),
    suggest_lesson: buildSuggestLessonTool(async (input) => {
      rememberStatic("suggest_lesson", input);
      return { lessons: [] };
    }),
    suggest_resource: buildSuggestResourceTool(async (input) => {
      rememberStatic("suggest_resource", input);
      return { resources: [] };
    }),
    update_goal_status: buildUpdateGoalStatusTool(async (input) => {
      rememberStatic("update_goal_status", input, true);
      return {
        id: input.goal_id,
        title: "eval-goal",
        status: input.status,
      };
    }),
    set_daily_challenge: buildSetDailyChallengeTool(async (input) => {
      rememberStatic("set_daily_challenge", input, true);
      return {
        id: "eval-challenge-id",
        challenge: input.challenge,
        for_date: input.for_date,
        replaced: false,
      };
    }),
    start_goal_sprint: buildStartGoalSprintTool(async (input) => {
      rememberStatic("start_goal_sprint", input, true);
      return {
        id: "eval-sprint-id",
        title: input.title,
        practice: input.practice,
        planned_end_date: input.planned_end_date,
        sprint_number: 1,
      };
    }),
    refine_capstone_section: buildRefineCapstoneSectionTool(async (input) => {
      rememberStatic("refine_capstone_section", input, true);
      return { ok: true as const, kind: input.kind, heading: input.heading };
    }),
  };

  return { tools, record };
}

/**
 * Run a single fixture against the real persona + mode prompts, capturing
 * the assistant text and any tool calls. Mirrors the production chat
 * route's configuration so eval results reflect real coach behavior.
 */
export async function runFixture(fixture: Fixture): Promise<RunnerOutput> {
  const systemPrompt = buildSystemPrompt(fixture);
  const { tools, record } = buildEvalTools();

  const modelMessages = fixture.transcript.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  const result = await generateText({
    model: claude(MODELS.sonnet),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
  });

  // Also capture tool calls directly from the model's output in case the
  // handler path wasn't taken (needsApproval=true tools).
  for (const call of result.toolCalls) {
    if (record.find((r) => r.toolCallId === call.toolCallId)) continue;
    record.push({
      toolName: call.toolName,
      toolCallId: call.toolCallId,
      input: call.input,
      needsApproval: NEEDS_APPROVAL.has(call.toolName),
    });
  }

  return {
    assistantText: result.text,
    toolCalls: record,
    systemPrompt,
    finishReason: result.finishReason,
    model: MODELS.sonnet,
  };
}

const NEEDS_APPROVAL = new Set([
  "finalize_goal",
  "update_goal_status",
  "set_daily_challenge",
  "start_goal_sprint",
  "refine_capstone_section",
]);
