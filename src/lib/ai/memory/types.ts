export const MEMORY_TYPES = [
  "preference",
  "pattern",
  "commitment",
  "relational_context",
  "stylistic",
  "other",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: "Preferences",
  pattern: "Patterns",
  commitment: "Commitments",
  relational_context: "Relational context",
  stylistic: "Stylistic",
  other: "Other",
};

export const MEMORY_CONFIDENCES = ["low", "medium", "high"] as const;
export type MemoryConfidence = (typeof MEMORY_CONFIDENCES)[number];

export type MemoryFact = {
  id: string;
  type: MemoryType;
  content: string;
  confidence: MemoryConfidence;
  sourceConversationId: string | null;
  sourceExcerpt: string | null;
  firstSeen: string;
  lastSeen: string;
  editedByUser: boolean;
  expiresAt: string | null;
};
