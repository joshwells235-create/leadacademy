import type { MemoryConfidence, MemoryType } from "@/lib/ai/memory/types";
import type { Json } from "@/lib/types/database";

export type LensKey = "self" | "others" | "org";

export type AssessmentKind = "pi" | "eqi" | "threesixty";

export type AssessmentSummary = {
  summary?: string;
  key_strengths?: string[];
  growth_areas?: string[];
  coaching_implications?: string;
  raw_highlights?: string;
};

export type CombinedAssessmentTheme = {
  theme: string;
  evidence: string;
};

export type GoalSprintSummaryItem = {
  sprintNumber: number;
  title: string;
  practice: string;
  durationDays: number;
  actionCount: number;
};

export type GoalCurrentSprint = {
  id: string;
  sprintNumber: number;
  title: string;
  practice: string;
  plannedEndDate: string;
  dayNumber: number;
  plannedTotalDays: number;
  plannedDaysRemaining: number; // can be negative if past planned end
  actionCountThisSprint: number;
};

export type GoalContextItem = {
  id: string;
  title: string;
  primaryLens: LensKey | null;
  status: string;
  targetDate: string | null;
  smartCriteria: Json | null;
  actionCount: number;
  daysSinceLastAction: number | null;
  currentSprint: GoalCurrentSprint | null;
  sprintHistory: GoalSprintSummaryItem[];
};

export type ActionContextItem = {
  occurredOn: string;
  description: string;
  impactArea: string | null;
  reflection: string | null;
  goalTitle: string | null;
};

export type ReflectionContextItem = {
  reflectedOn: string;
  content: string;
  themes: string[];
};

export type SessionRecapContextItem = {
  sessionDate: string;
  content: string;
};

export type ActionItemContextItem = {
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
};

export type CourseProgressContextItem = {
  courseTitle: string;
  currentLessonTitle: string | null;
  lessonsCompleted: number;
  lessonsTotal: number;
};

export type DailyChallengeContextItem = {
  todayChallenge: string | null;
  todayCompleted: boolean;
  completedLast7Days: number;
  totalLast7Days: number;
};

export type MemoryFactContextItem = {
  type: MemoryType;
  content: string;
  confidence: MemoryConfidence;
  lastSeen: string;
  editedByUser: boolean;
};

export type LearnerContext = {
  identity: {
    name: string;
    timezone: string | null;
    organization: string | null;
    cohort: string | null;
    role: string | null;
  };
  assessments: Partial<Record<AssessmentKind, AssessmentSummary>>;
  assessmentCombinedThemes: CombinedAssessmentTheme[];
  goals: GoalContextItem[];
  recentActions: ActionContextItem[];
  reflections: ReflectionContextItem[];
  lastSessionRecap: SessionRecapContextItem | null;
  openActionItems: ActionItemContextItem[];
  mostRecentCompletedActionItem: ActionItemContextItem | null;
  courseProgress: CourseProgressContextItem | null;
  dailyChallenge: DailyChallengeContextItem;
  memoryFacts: MemoryFactContextItem[];
};
