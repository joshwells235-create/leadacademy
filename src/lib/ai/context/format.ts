import { MEMORY_TYPE_LABELS, type MemoryType } from "@/lib/ai/memory/types";
import type { AssessmentKind, AssessmentSummary, LearnerContext, LensKey } from "./types";

const ASSESSMENT_LABEL: Record<AssessmentKind, string> = {
  pi: "Predictive Index",
  eqi: "EQ-i 2.0",
  threesixty: "360-Degree Feedback",
};

const LENS_LABEL: Record<LensKey, string> = {
  self: "Leading Self",
  others: "Leading Others",
  org: "Leading the Organization",
};

const REFLECTION_PREVIEW = 300;
const ACTION_DESCRIPTION_PREVIEW = 200;
const ACTION_REFLECTION_PREVIEW = 200;
const RECAP_PREVIEW = 500;
const ASSESSMENT_HIGHLIGHTS_PREVIEW = 500;

export function formatLearnerContext(ctx: LearnerContext): string {
  const sections: string[] = [];
  sections.push(formatIdentity(ctx));
  sections.push(formatProfile(ctx));
  sections.push(formatMemory(ctx));
  sections.push(formatAssessments(ctx));
  sections.push(formatGoals(ctx));
  sections.push(formatRecentActions(ctx));
  sections.push(formatReflections(ctx));
  sections.push(formatSessionRecap(ctx));
  sections.push(formatActionItems(ctx));
  sections.push(formatCourseProgress(ctx));
  sections.push(formatDailyChallenge(ctx));
  return sections.filter(Boolean).join("\n\n");
}

function formatMemory(ctx: LearnerContext): string {
  if (ctx.memoryFacts.length === 0) return "";
  const grouped = new Map<MemoryType, typeof ctx.memoryFacts>();
  for (const f of ctx.memoryFacts) {
    const list = grouped.get(f.type) ?? [];
    list.push(f);
    grouped.set(f.type, list);
  }
  const parts: string[] = ["What you remember about this learner (long-term memory):"];
  const ORDER: MemoryType[] = [
    "commitment",
    "pattern",
    "relational_context",
    "preference",
    "stylistic",
    "other",
  ];
  for (const type of ORDER) {
    const items = grouped.get(type);
    if (!items || items.length === 0) continue;
    parts.push(`${MEMORY_TYPE_LABELS[type]}:`);
    for (const f of items) {
      const confidence = f.editedByUser ? "user-asserted" : f.confidence;
      parts.push(`- ${f.content} (${confidence})`);
    }
  }
  return parts.join("\n");
}

function formatIdentity(ctx: LearnerContext): string {
  const lines = [
    `Today: ${ctx.today.iso} (${ctx.today.weekday}). Use this when choosing any date (goal target_date, sprint planned_end_date, daily challenge for_date). Never pick a date before today.`,
    `Learner: ${ctx.identity.name}`,
    ctx.identity.organization ? `Organization: ${ctx.identity.organization}` : null,
    ctx.identity.cohort ? `Cohort: ${ctx.identity.cohort}` : null,
    ctx.identity.role ? `Role: ${ctx.identity.role}` : null,
    ctx.identity.timezone ? `Timezone: ${ctx.identity.timezone}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

const TENURE_LABEL: Record<string, string> = {
  "<1y": "less than a year",
  "1-3y": "1–3 years",
  "3-7y": "3–7 years",
  "7y+": "7+ years",
};

const COMPANY_SIZE_LABEL: Record<string, string> = {
  solo: "solo",
  "<50": "under 50 people",
  "50-250": "50–250 people",
  "250-1k": "250–1,000 people",
  "1k-5k": "1,000–5,000 people",
  "5k+": "5,000+ people",
};

function formatProfile(ctx: LearnerContext): string {
  const p = ctx.profile;
  const hasAny =
    p.roleTitle ||
    p.functionArea ||
    p.teamSize != null ||
    p.totalOrgInfluence != null ||
    p.tenureAtOrg ||
    p.tenureInLeadership ||
    p.companySize ||
    p.industry ||
    p.contextNotes;
  if (!hasAny) {
    return "About this leader: (profile not yet gathered — run the intake if this is the first conversation).";
  }

  const lines: string[] = ["About this leader:"];
  if (p.roleTitle) lines.push(`- Role: ${p.roleTitle}`);
  if (p.functionArea) lines.push(`- Function: ${p.functionArea}`);
  if (p.teamSize != null) {
    const suffix =
      p.totalOrgInfluence != null && p.totalOrgInfluence > p.teamSize
        ? ` (and ~${p.totalOrgInfluence} under them across skip-levels)`
        : "";
    lines.push(`- Team: ${p.teamSize} direct report${p.teamSize === 1 ? "" : "s"}${suffix}`);
  } else if (p.totalOrgInfluence != null) {
    lines.push(`- ~${p.totalOrgInfluence} people in their org sphere`);
  }
  if (p.tenureAtOrg) {
    lines.push(`- ${TENURE_LABEL[p.tenureAtOrg] ?? p.tenureAtOrg} at their current organization`);
  }
  if (p.tenureInLeadership) {
    lines.push(
      `- ${TENURE_LABEL[p.tenureInLeadership] ?? p.tenureInLeadership} in leadership roles across their career`,
    );
  }
  if (p.companySize || p.industry) {
    const size = p.companySize ? COMPANY_SIZE_LABEL[p.companySize] ?? p.companySize : null;
    const parts = [size, p.industry].filter(Boolean).join(", ");
    lines.push(`- Company: ${parts}`);
  }
  if (p.contextNotes) {
    lines.push(`- They told you: "${p.contextNotes}"`);
  }
  return lines.join("\n");
}

function formatAssessments(ctx: LearnerContext): string {
  const entries = Object.entries(ctx.assessments) as Array<[AssessmentKind, AssessmentSummary]>;
  const blocks: string[] = [];

  if (ctx.assessmentCombinedThemes.length > 0) {
    const themeLines = ["Integrated themes across the learner's assessments:"];
    for (const t of ctx.assessmentCombinedThemes) {
      themeLines.push(`- ${t.theme} — evidence: ${t.evidence}`);
    }
    blocks.push(themeLines.join("\n"));
  }

  if (entries.length === 0) {
    if (blocks.length === 0) return "Assessment summaries: none uploaded yet.";
    blocks.push("Assessment summaries: none uploaded yet.");
    return blocks.join("\n\n");
  }

  const parts: string[] = ["Assessment summaries:"];
  for (const [kind, summary] of entries) {
    parts.push(`${ASSESSMENT_LABEL[kind] ?? kind}:`);
    if (summary.summary) parts.push(`  Summary: ${summary.summary}`);
    if (kind === "pi") {
      // PI results describe preferences, not fixed traits. Frame accordingly
      // so the thought partner doesn't treat the lists as diagnostic labels.
      if (summary.key_strengths?.length) {
        parts.push(`  Natural tendencies: ${summary.key_strengths.join(", ")}`);
      }
      if (summary.growth_areas?.length) {
        parts.push(`  Watch-outs to be aware of: ${summary.growth_areas.join(", ")}`);
      }
    } else {
      if (summary.key_strengths?.length) {
        parts.push(`  Key strengths: ${summary.key_strengths.join(", ")}`);
      }
      if (summary.growth_areas?.length) {
        parts.push(`  Growth areas: ${summary.growth_areas.join(", ")}`);
      }
    }
    if (summary.coaching_implications) {
      parts.push(`  Coaching implications: ${summary.coaching_implications}`);
    }
    if (summary.raw_highlights) {
      parts.push(
        `  Raw highlights: ${truncate(summary.raw_highlights, ASSESSMENT_HIGHLIGHTS_PREVIEW)}`,
      );
    }
  }
  blocks.push(parts.join("\n"));
  return blocks.join("\n\n");
}

function formatGoals(ctx: LearnerContext): string {
  if (ctx.goals.length === 0) return "Active goals: none yet.";
  const lines = ["Active goals:"];
  for (const g of ctx.goals) {
    const lens = g.primaryLens ? ` (started from ${LENS_LABEL[g.primaryLens]})` : "";
    const target = g.targetDate ? `, target ${g.targetDate}` : "";
    const momentum = formatGoalMomentum(g.actionCount, g.daysSinceLastAction);
    lines.push(`- ${g.title}${lens} — ${g.status}${target}${momentum}`);
    if (g.currentSprint) {
      const s = g.currentSprint;
      const status =
        s.plannedDaysRemaining >= 0
          ? `day ${s.dayNumber} of ${s.plannedTotalDays} (${s.plannedDaysRemaining} days remaining)`
          : `day ${s.dayNumber}, ${Math.abs(s.plannedDaysRemaining)} days past planned end`;
      lines.push(`    Current sprint ${s.sprintNumber}: "${s.title}" — ${status}`);
      lines.push(`    Practicing: ${s.practice}`);
      lines.push(`    Actions logged this sprint: ${s.actionCountThisSprint}`);
    } else {
      lines.push("    (no active sprint)");
    }
    if (g.sprintHistory.length > 0) {
      const past = g.sprintHistory
        .map(
          (h) =>
            `(${h.sprintNumber}) "${h.title}" — ${h.durationDays} days, ${h.actionCount} actions`,
        )
        .join("; ");
      lines.push(`    Past sprints: ${past}`);
    }
  }
  return lines.join("\n");
}

function formatGoalMomentum(actionCount: number, daysSinceLastAction: number | null): string {
  if (actionCount === 0) return " (no actions logged yet)";
  if (daysSinceLastAction === null) return "";
  const noun = actionCount === 1 ? "action" : "actions";
  const when =
    daysSinceLastAction === 0
      ? "today"
      : daysSinceLastAction === 1
        ? "yesterday"
        : `${daysSinceLastAction} days ago`;
  return ` (${actionCount} ${noun}, last ${when})`;
}

function formatRecentActions(ctx: LearnerContext): string {
  if (ctx.recentActions.length === 0) return "Recent actions: none logged.";
  const lines = ["Recent actions (most recent first):"];
  for (const a of ctx.recentActions) {
    const tag = a.impactArea ? ` [${a.impactArea}]` : "";
    const goal = a.goalTitle ? ` {goal: ${a.goalTitle}}` : "";
    const reflection = a.reflection
      ? ` — reflection: ${truncate(a.reflection, ACTION_REFLECTION_PREVIEW)}`
      : "";
    lines.push(
      `- ${a.occurredOn}${tag}${goal}: ${truncate(a.description, ACTION_DESCRIPTION_PREVIEW)}${reflection}`,
    );
  }
  return lines.join("\n");
}

function formatReflections(ctx: LearnerContext): string {
  if (ctx.reflections.length === 0) return "Recent reflections: none yet.";
  const lines = [`Recent reflections (last ${ctx.reflections.length}, most recent first):`];
  for (const r of ctx.reflections) {
    const themes = r.themes.length > 0 ? ` [themes: ${r.themes.join(", ")}]` : "";
    lines.push(`- ${r.reflectedOn}${themes}: ${truncate(r.content, REFLECTION_PREVIEW)}`);
  }
  return lines.join("\n");
}

function formatSessionRecap(ctx: LearnerContext): string {
  if (!ctx.lastSessionRecap) return "Most recent coaching session recap: none yet.";
  return [
    `Most recent coaching session recap (${ctx.lastSessionRecap.sessionDate}):`,
    truncate(ctx.lastSessionRecap.content, RECAP_PREVIEW),
  ].join("\n");
}

function formatActionItems(ctx: LearnerContext): string {
  const parts: string[] = [];
  if (ctx.openActionItems.length === 0) {
    parts.push("Open coach action items: none.");
  } else {
    parts.push("Open coach action items:");
    for (const i of ctx.openActionItems) {
      const due = i.dueDate ? ` (due ${i.dueDate})` : "";
      const desc = i.description ? ` — ${truncate(i.description, 200)}` : "";
      parts.push(`- ${i.title}${due}${desc}`);
    }
  }
  const completed = ctx.mostRecentCompletedActionItem;
  if (completed?.completedAt) {
    const completedDate = completed.completedAt.slice(0, 10);
    parts.push(`Most recently completed action item (${completedDate}): ${completed.title}`);
  }
  return parts.join("\n");
}

function formatCourseProgress(ctx: LearnerContext): string {
  if (!ctx.courseProgress) return "Course progress: no active course.";
  const cp = ctx.courseProgress;
  const lesson = cp.currentLessonTitle ? `, currently on "${cp.currentLessonTitle}"` : "";
  return `Course progress: "${cp.courseTitle}" — ${cp.lessonsCompleted}/${cp.lessonsTotal} lessons complete${lesson}.`;
}

function formatDailyChallenge(ctx: LearnerContext): string {
  const dc = ctx.dailyChallenge;
  const parts: string[] = [];
  if (dc.todayChallenge) {
    const status = dc.todayCompleted ? "completed" : "not yet completed";
    parts.push(`Today's challenge: ${dc.todayChallenge} (${status})`);
  } else {
    parts.push("Today's challenge: not generated yet.");
  }
  if (dc.totalLast7Days > 0) {
    parts.push(
      `Last 7 days: completed ${dc.completedLast7Days} of ${dc.totalLast7Days} daily challenges.`,
    );
  }
  return parts.join("\n");
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
