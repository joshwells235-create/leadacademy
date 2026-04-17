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
  const [profileRes, orgRes, goalsRes, actionsRes, assessmentRes] = await Promise.all([
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
      .select("id, primary_lens, title, status, target_date, smart_criteria")
      .eq("user_id", userId)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false }),
    supabase
      .from("action_logs")
      .select("description, impact_area, occurred_on, reflection")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("assessments")
      .select("ai_summary")
      .eq("user_id", userId)
      .maybeSingle(),
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
              `- ${g.title}${g.primary_lens ? ` (started from ${lensLabel(g.primary_lens)})` : ""} — ${g.status}${g.target_date ? `, target ${g.target_date}` : ""}`,
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

  // Assessment summaries — only included if uploaded.
  const assessmentSummary = assessmentRes.data?.ai_summary;
  let assessmentBlock = "Assessment summaries: none uploaded yet.";
  if (assessmentSummary && typeof assessmentSummary === "object" && Object.keys(assessmentSummary).length > 0) {
    const parts: string[] = [];
    const TYPE_LABELS: Record<string, string> = { pi: "Predictive Index", eqi: "EQ-i 2.0", threesixty: "360-Degree Feedback" };
    for (const [key, val] of Object.entries(assessmentSummary as Record<string, unknown>)) {
      if (val && typeof val === "object") {
        const v = val as Record<string, unknown>;
        const label = TYPE_LABELS[key] ?? key;
        parts.push(`${label}:`);
        if (v.summary) parts.push(`  Summary: ${v.summary}`);
        if (Array.isArray(v.key_strengths) && v.key_strengths.length > 0) {
          parts.push(`  Key strengths: ${v.key_strengths.join(", ")}`);
        }
        if (Array.isArray(v.growth_areas) && v.growth_areas.length > 0) {
          parts.push(`  Growth areas: ${v.growth_areas.join(", ")}`);
        }
        if (v.coaching_implications) parts.push(`  Coaching implications: ${v.coaching_implications}`);
        if (v.raw_highlights) parts.push(`  Raw highlights: ${truncate(v.raw_highlights as string, 500)}`);
      }
    }
    if (parts.length > 0) {
      assessmentBlock = "Assessment summaries:\n" + parts.join("\n");
    }
  }

  return [header, goalsBlock, actionsBlock, assessmentBlock].join("\n\n");
}

function lensLabel(lens: string | null): string {
  return lens === "self"
    ? "Leading Self"
    : lens === "others"
      ? "Leading Others"
      : lens === "org"
        ? "Leading Org"
        : (lens ?? "");
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
