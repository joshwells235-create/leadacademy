import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { assembleLearnerContext } from "./assemble";
import { formatLearnerContext } from "./format";

/**
 * Assembles the learner's context for the thought partner and returns it
 * as a human-readable string for the system prompt. Runs every turn of
 * every chat so the thought partner always sees the full person.
 *
 * Prefer `assembleLearnerContext` directly when you need the structured
 * object (evals, proactive notifications, analytics).
 */
export async function buildLearnerContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const ctx = await assembleLearnerContext(supabase, userId);
  return formatLearnerContext(ctx);
}

export { assembleLearnerContext } from "./assemble";
export { formatLearnerContext } from "./format";
export type * from "./types";
