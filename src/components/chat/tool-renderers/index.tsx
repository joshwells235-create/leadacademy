"use client";

import { CreateReflectionRenderer } from "./create-reflection";
import { FinalizeGoalRenderer } from "./finalize-goal";
import { LogActionRenderer } from "./log-action";
import { RefineCapstoneSectionRenderer } from "./refine-capstone-section";
import { SetDailyChallengeRenderer } from "./set-daily-challenge";
import { StartGoalSprintRenderer } from "./start-goal-sprint";
import { SuggestLessonRenderer } from "./suggest-lesson";
import { SuggestResourceRenderer } from "./suggest-resource";
import type { ToolRendererProps } from "./types";
import { UpdateGoalStatusRenderer } from "./update-goal-status";

type Renderer = (props: ToolRendererProps) => React.ReactNode;

const RENDERERS: Record<string, Renderer> = {
  "tool-finalize_goal": FinalizeGoalRenderer,
  "tool-log_action": LogActionRenderer,
  "tool-create_reflection": CreateReflectionRenderer,
  "tool-suggest_lesson": SuggestLessonRenderer,
  "tool-suggest_resource": SuggestResourceRenderer,
  "tool-update_goal_status": UpdateGoalStatusRenderer,
  "tool-set_daily_challenge": SetDailyChallengeRenderer,
  "tool-start_goal_sprint": StartGoalSprintRenderer,
  "tool-refine_capstone_section": RefineCapstoneSectionRenderer,
  // tag_themes has no UI — it silently enriches a reflection's themes.
  "tool-tag_themes": () => null,
};

export function renderToolPart(props: ToolRendererProps): React.ReactNode {
  const Renderer = RENDERERS[props.part.type];
  if (!Renderer) return null;
  return <Renderer {...props} />;
}

export type { ApprovalHandler, ToolPart, ToolRendererProps } from "./types";
