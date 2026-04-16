import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Assembles the learner's context for the coach. Returns a human-readable
 * string the model reads as part of the system prompt. Keep it compact —
 * this goes on every turn.
 */
export async function buildLearnerContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const [profileRes, orgRes, goalsRes, actionsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, timezone")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role, cohorts(name), organizations(name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, tier, title, status, target_date, smart_criteria")
      .eq("user_id", userId)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false }),
    supabase
      .from("action_logs")
      .select("description, impact_area, occurred_on, reflection")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .limit(10),
  ]);

  const name = profileRes.data?.display_name ?? "the learner";
  const orgName = orgRes.data?.organizations?.name ?? null;
  const cohortName = orgRes.data?.cohorts?.name ?? null;
  const role = orgRes.data?.role ?? null;

  const header = [
    `Learner: ${name}`,
    orgName ? `Organization: ${orgName}` : null,
    cohortName ? `Cohort: ${cohortName}` : null,
    role ? `Role: ${role}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const goals = goalsRes.data ?? [];
  const goalsBlock =
    goals.length === 0
      ? "Active goals: none yet."
      : "Active goals:\n" +
        goals
          .map(
            (g) =>
              `- [${tierLabel(g.tier)}] ${g.title} (${g.status}${g.target_date ? `, target ${g.target_date}` : ""})`,
          )
          .join("\n");

  const actions = actionsRes.data ?? [];
  const actionsBlock =
    actions.length === 0
      ? "Recent actions: none logged."
      : "Recent actions (most recent first):\n" +
        actions
          .map(
            (a) =>
              `- ${a.occurred_on}${a.impact_area ? ` [${a.impact_area}]` : ""}: ${truncate(a.description, 200)}${a.reflection ? ` — reflection: ${truncate(a.reflection, 200)}` : ""}`,
          )
          .join("\n");

  return [header, goalsBlock, actionsBlock].join("\n\n");
}

function tierLabel(tier: string): string {
  return tier === "self"
    ? "Leading Self"
    : tier === "others"
      ? "Leading Others"
      : tier === "org"
        ? "Leading Org"
        : tier;
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
