import { generateObject } from "ai";
import { z } from "zod";
import { claude, MODELS } from "@/lib/ai/client";
import type { Fixture, JudgedCriterion, RunnerOutput } from "./types";

const JUDGE_SYSTEM = `You are grading the behavior of an AI leadership coach against a rubric. You will receive:
1. The transcript of a conversation between a learner and their coach
2. The coach's final response under test (assistant text + any tool calls)
3. A list of rubric criteria — each is a statement about the coach's final response

For each criterion, decide whether the statement is TRUE or FALSE of the coach's response. Use only what the coach actually said or did. Do not grade on what you wish the coach had said.

Rules:
- If a criterion is about a specific tool being called, check the tool calls list. If the tool was called with appropriate input, the statement about that tool is TRUE.
- If a criterion is about what the coach said, check the assistant text. Quote specifically in your reasoning.
- Be strict. "Roughly references the goal" is FALSE if the goal is not named. "Tends toward language" is FALSE if the coach used "is" instead.
- Give one sentence of reasoning per criterion, citing specific evidence.`;

const judgeResponseSchema = z.object({
  criteria: z.array(
    z.object({
      criterion: z.string(),
      observed: z
        .boolean()
        .describe(
          "Whether the statement IS true of the coach's response. Not whether it SHOULD be — purely what is observed.",
        ),
      reasoning: z.string().min(1).max(500),
    }),
  ),
});

/**
 * Judge a fixture's output against its rubric using Opus for quality.
 * Returns one JudgedCriterion per rubric item. `passed` is true when the
 * judge's observed value matches the rubric's expect.
 */
export async function judgeFixture(
  fixture: Fixture,
  output: RunnerOutput,
): Promise<JudgedCriterion[]> {
  const transcriptBlock = fixture.transcript
    .map((m) => `${m.role === "user" ? "Learner" : "Coach"}: ${m.text}`)
    .join("\n\n");

  const toolCallsBlock =
    output.toolCalls.length === 0
      ? "(no tool calls)"
      : output.toolCalls
          .map(
            (t) =>
              `- ${t.toolName}${t.needsApproval ? " (needs approval)" : ""}: ${JSON.stringify(t.input)}`,
          )
          .join("\n");

  const criteriaBlock = fixture.rubric.map((c, i) => `${i + 1}. ${c.criterion}`).join("\n");

  const prompt = `## Conversation so far
${transcriptBlock}

## Coach's final response under test
Assistant text:
"""
${output.assistantText || "(no text produced)"}
"""

Tool calls made:
${toolCallsBlock}

## Rubric — evaluate each criterion
${criteriaBlock}

Return one entry per criterion, in the same order. For each, state whether the statement is TRUE or FALSE of the coach's response and cite specific evidence.`;

  const result = await generateObject({
    model: claude(MODELS.opus),
    system: JUDGE_SYSTEM,
    prompt,
    schema: judgeResponseSchema,
    maxOutputTokens: 3000,
  });

  const judged = result.object.criteria;
  const out: JudgedCriterion[] = [];
  for (let i = 0; i < fixture.rubric.length; i++) {
    const r = fixture.rubric[i];
    const j = judged[i];
    if (!j) {
      out.push({
        criterion: r.criterion,
        expect: r.expect,
        observed: false,
        reasoning: "(judge did not return a verdict for this criterion)",
        passed: false,
      });
      continue;
    }
    out.push({
      criterion: r.criterion,
      expect: r.expect,
      observed: j.observed,
      reasoning: j.reasoning,
      passed: j.observed === r.expect,
    });
  }
  return out;
}
