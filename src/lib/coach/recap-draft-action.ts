"use server";

import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate a first-pass session recap draft for the coach based on the
 * learner's activity since the coach's last recap (or the last 14 days
 * if there's no prior recap).
 *
 * This is a coach-side convenience — it doesn't save anything. The draft
 * comes back as text for the coach to edit in the textarea. The prompt
 * explicitly frames the output as a reminder / starting point, not a
 * replacement for the coach's own judgment. We only pull from data the
 * coach already has read access to (RLS enforces this).
 */
export async function generateRecapDraft(
  learnerId: string,
  sessionDate: string,
): Promise<{ draft: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Permission check — coach must be assigned (or super_admin). RLS
  // would block the reads below anyway, but we want a friendlier error.
  const [{ data: assignment }, { data: profile }] = await Promise.all([
    supabase
      .from("coach_assignments")
      .select("id")
      .eq("coach_user_id", user.id)
      .eq("learner_user_id", learnerId)
      .is("active_to", null)
      .maybeSingle(),
    supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!assignment && !profile?.super_admin) {
    return { error: "You're not assigned to this learner." };
  }

  // Anchor: most recent recap, else 14 days ago.
  const { data: latestRecap } = await supabase
    .from("session_recaps")
    .select("session_date, content")
    .eq("coach_user_id", user.id)
    .eq("learner_user_id", learnerId)
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallback = new Date();
  fallback.setDate(fallback.getDate() - 14);
  const anchorDate = latestRecap?.session_date ?? fallback.toISOString().slice(0, 10);
  const anchorTs = `${anchorDate}T00:00:00Z`;

  const [
    learnerProfile,
    preSessionRes,
    actionsRes,
    reflectionsRes,
    openItemsRes,
    completedItemsRes,
    goalsRes,
    sprintsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role_title")
      .eq("user_id", learnerId)
      .maybeSingle(),
    supabase
      .from("pre_session_notes")
      .select("want_to_discuss, whats_been_hard, whats_going_well, session_date, created_at")
      .eq("user_id", learnerId)
      .gte("created_at", anchorTs)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("action_logs")
      .select("description, reflection, occurred_on, goals(title)")
      .eq("user_id", learnerId)
      .gt("occurred_on", anchorDate)
      .order("occurred_on", { ascending: false })
      .limit(15),
    supabase
      .from("reflections")
      .select("content, themes, reflected_on")
      .eq("user_id", learnerId)
      .gt("reflected_on", anchorDate)
      .order("reflected_on", { ascending: false })
      .limit(10),
    supabase
      .from("action_items")
      .select("title, description, due_date")
      .eq("learner_user_id", learnerId)
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("action_items")
      .select("title, completed_at")
      .eq("learner_user_id", learnerId)
      .eq("completed", true)
      .gte("completed_at", anchorTs)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("goals")
      .select("id, title, primary_lens, status")
      .eq("user_id", learnerId)
      .neq("status", "archived"),
    supabase
      .from("goal_sprints")
      .select("goal_id, sprint_number, title, practice, action_count, planned_end_date, status")
      .eq("user_id", learnerId)
      .eq("status", "active"),
  ]);

  const learnerName = learnerProfile.data?.display_name ?? "The learner";

  const formatGoals = () => {
    const goals = goalsRes.data ?? [];
    if (goals.length === 0) return "(none active)";
    const sprintByGoal = new Map((sprintsRes.data ?? []).map((s) => [s.goal_id, s] as const));
    return goals
      .map((g) => {
        const sprint = sprintByGoal.get(g.id);
        const sprintLine = sprint
          ? ` · sprint ${sprint.sprint_number}: ${sprint.title} (${sprint.action_count} actions, ends ${sprint.planned_end_date})`
          : " · no active sprint";
        return `- ${g.title}${sprintLine}`;
      })
      .join("\n");
  };

  const formatList = <T>(items: T[] | null, fmt: (t: T) => string, empty: string): string => {
    if (!items || items.length === 0) return empty;
    return items.map((i) => `- ${fmt(i)}`).join("\n");
  };

  const contextBlock = [
    `Learner: ${learnerName}`,
    `Anchor window: from ${anchorDate} to today (the session you're recapping is dated ${sessionDate}).`,
    "",
    "## Active goals and sprints",
    formatGoals(),
    "",
    "## Pre-session notes learner submitted in this window",
    formatList(
      preSessionRes.data,
      (n) =>
        [
          `Session date: ${n.session_date ?? "(not set)"}`,
          `  Want to discuss: ${n.want_to_discuss}`,
          n.whats_been_hard ? `  Hard: ${n.whats_been_hard}` : null,
          n.whats_going_well ? `  Going well: ${n.whats_going_well}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      "(none)",
    ),
    "",
    "## Actions logged since anchor",
    formatList(
      actionsRes.data,
      (a) =>
        `[${a.occurred_on}] ${a.description}${a.goals?.title ? ` (→ ${a.goals.title})` : ""}${a.reflection ? ` — ${a.reflection}` : ""}`,
      "(none)",
    ),
    "",
    "## Reflections since anchor",
    formatList(
      reflectionsRes.data,
      (r) =>
        `[${r.reflected_on}] ${r.content.length > 300 ? `${r.content.slice(0, 300)}…` : r.content}${(r.themes ?? []).length > 0 ? ` (themes: ${(r.themes ?? []).join(", ")})` : ""}`,
      "(none)",
    ),
    "",
    "## Action items completed since anchor",
    formatList(
      completedItemsRes.data,
      (i) => `${i.title} (${i.completed_at?.slice(0, 10) ?? "—"})`,
      "(none)",
    ),
    "",
    "## Action items still open",
    formatList(
      openItemsRes.data,
      (i) => `${i.title}${i.due_date ? ` (due ${i.due_date})` : ""}`,
      "(none)",
    ),
    "",
    "## Previous recap (if any) — the last time you talked to them",
    latestRecap?.content ?? "(none)",
  ].join("\n");

  const system = `You are generating a FIRST-DRAFT session recap for an executive coach who just finished a 1:1 session with a learner in the LeadShift Leadership Academy. The coach will edit before saving.

Your draft captures what they likely covered and commits to based on the learner's recent activity — NOT what actually happened in the session (you weren't there). Frame it so the coach can quickly:
1. Remember what the learner brought in (from pre-session notes)
2. Notice what moved since the last check-in (actions, reflections, completed items)
3. Identify what's worth revisiting next time

Rules:
- One short paragraph (3-6 sentences). No bullet lists.
- Write in the coach's voice ("we discussed", "they committed to", "worth revisiting"), not third-person.
- Ground every claim in the context data. Do NOT invent details.
- If the data is thin, say so honestly: "Light activity since last recap — worth asking what's getting in the way."
- End with ONE specific thing to revisit next session, drawn from open action items or unresolved tensions in the reflections.
- Keep it under 150 words.
- Do NOT include a greeting, signature, or meta-commentary. Output only the recap body.`;

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system,
      prompt: `Context:\n\n${contextBlock}\n\nWrite the draft now.`,
      maxOutputTokens: 500,
    });
    const text = result.text.trim();
    if (!text) return { error: "Draft came back empty. Try again." };
    return { draft: text };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Couldn't generate draft: ${err.message}`
          : "Couldn't generate draft.",
    };
  }
}
