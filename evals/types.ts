import type { LearnerContext } from "@/lib/ai/context/types";

export type FixtureMode = "general" | "goal" | "reflection" | "assessment" | "capstone";

export type FixtureMessage = {
  role: "user" | "assistant";
  text: string;
};

export type FixtureCriterion = {
  /**
   * Plain-English statement of a behavior the judge will evaluate.
   * The judge answers: does this statement hold of the coach's final response?
   */
  criterion: string;
  /**
   * What the statement SHOULD evaluate to if the coach behaves well.
   * true = criterion should hold; false = criterion should NOT hold.
   */
  expect: boolean;
};

/**
 * Learner context overrides — partial so fixtures only specify what matters.
 * Anything unspecified falls back to a neutral empty context.
 */
export type FixtureContext = Partial<LearnerContext>;

export type FixtureGoalContext = {
  primaryLens?: "self" | "others" | "org";
  goalId?: string;
};

export type Fixture = {
  name: string;
  category: string;
  mode: FixtureMode;
  goalContext?: FixtureGoalContext;
  context: FixtureContext;
  /**
   * The conversation leading up to the coach's response under test.
   * The final message must be role="user". The runner sends the full
   * transcript and evaluates what the coach generates next.
   */
  transcript: FixtureMessage[];
  rubric: FixtureCriterion[];
};

export type ToolCallCapture = {
  toolName: string;
  toolCallId: string;
  input: unknown;
  /** Whether the tool would have needed approval in production. */
  needsApproval: boolean;
};

export type RunnerOutput = {
  assistantText: string;
  toolCalls: ToolCallCapture[];
  /** Full system prompt the model saw — useful for debugging regressions. */
  systemPrompt: string;
  finishReason: string | undefined;
  model: string;
};

export type JudgedCriterion = {
  criterion: string;
  expect: boolean;
  observed: boolean;
  reasoning: string;
  passed: boolean;
};

export type FixtureResult = {
  name: string;
  category: string;
  mode: FixtureMode;
  score: number; // 0..1
  passed: boolean; // 1.0
  criteria: JudgedCriterion[];
  output: RunnerOutput;
  durationMs: number;
  error?: string;
};

export type EvalRunReport = {
  runAt: string;
  gitSha: string | null;
  aggregateScore: number; // 0..1
  fixtureCount: number;
  fixturesPassed: number;
  fixtures: FixtureResult[];
};
