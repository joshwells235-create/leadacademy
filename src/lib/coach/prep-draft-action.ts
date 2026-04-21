"use server";

import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate a FIRST-DRAFT session-prep doc for a coach about to meet with a
 * learner. Looks FORWARD (what to explore this session), as opposed to the
 * recap-draft action which looks BACKWARD (what just happened).
 *
 * Ephemeral: returns text only, no persistence. The coach reads it, maybe
 * copies a line or two into their own notes or uses it as mental scaffolding
 * during the session. No approval flow — it's a private thinking tool.
 *
 * Grounded in the since-last-recap window (or last 14 days if no prior
 * recap) across learner activity visible to the coach via RLS.
 */
export async function generateSessionPrepDraft(
  learnerId: string,
): Promise<{ draft: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

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
    goalsRes,
    sprintsRes,
    flaggedQsRes,
    coachNoteRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role_title, context_notes")
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
      .from("goals")
      .select("id, title, primary_lens, status, impact_self, impact_others, impact_org")
      .eq("user_id", learnerId)
      .neq("status", "archived"),
    supabase
      .from("goal_sprints")
      .select("goal_id, sprint_number, title, practice, action_count, planned_end_date, status")
      .eq("user_id", learnerId)
      .eq("status", "active"),
    supabase
      .from("lesson_questions")
      .select("question, created_at, flagged_to_coach_at, lessons(title)")
      .eq("user_id", learnerId)
      .not("flagged_to_coach_at", "is", null)
      .is("coach_responded_at", null)
      .is("resolved_at", null)
      .order("flagged_to_coach_at", { ascending: true })
      .limit(5),
    supabase
      .from("coach_notes")
      .select("content, updated_at")
      .eq("coach_user_id", user.id)
      .eq("learner_user_id", learnerId)
      .maybeSingle(),
  ]);

  const learnerName = learnerProfile.data?.display_name ?? "The learner";

  const formatList = <T>(items: T[] | null, fmt: (t: T) => string, empty: string): string => {
    if (!items || items.length === 0) return empty;
    return items.map((i) => `- ${fmt(i)}`).join("\n");
  };

  const formatGoals = () => {
    const goals = goalsRes.data ?? [];
    if (goals.length === 0) return "(none active)";
    const sprintByGoal = new Map((sprintsRes.data ?? []).map((s) => [s.goal_id, s] as const));
    return goals
      .map((g) => {
        const sprint = sprintByGoal.get(g.id);
        const sprintLine = sprint
          ? ` · sprint ${sprint.sprint_number}: "${sprint.title}" — ${sprint.practice} (${sprint.action_count} actions, ends ${sprint.planned_end_date})`
          : " · no active sprint";
        return `- ${g.title}${sprintLine}`;
      })
      .join("\n");
  };

  const contextBlock = [
    `Learner: ${learnerName}${learnerProfile.data?.role_title ? ` (${learnerProfile.data.role_title})` : ""}`,
    learnerProfile.data?.context_notes ? `Context notes: ${learnerProfile.data.context_notes}` : "",
    "",
    `Anchor window: since ${anchorDate} (last recap${latestRecap ? "" : " — none, using 14d fallback"}).`,
    "",
    "## Goals and active sprints",
    formatGoals(),
    "",
    "## Pre-session notes the learner submitted in this window",
    formatList(
      preSessionRes.data,
      (n) =>
        [
          `Target session ${n.session_date ?? "(not set)"}`,
          `  Want to discuss: ${n.want_to_discuss}`,
          n.whats_been_hard ? `  Hard: ${n.whats_been_hard}` : null,
          n.whats_going_well ? `  Going well: ${n.whats_going_well}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      "(none — the learner didn't submit pre-session notes this window)",
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
    "## Open action items (you assigned)",
    formatList(
      openItemsRes.data,
      (i) => `${i.title}${i.due_date ? ` (due ${i.due_date})` : ""}`,
      "(none)",
    ),
    "",
    "## Flagged questions waiting on you",
    formatList(
      flaggedQsRes.data,
      (q) =>
        `"${q.question.slice(0, 200)}"${(q.lessons as unknown as { title?: string } | null)?.title ? ` (from ${(q.lessons as unknown as { title: string }).title})` : ""}`,
      "(none)",
    ),
    "",
    "## Your previous recap (if any)",
    latestRecap?.content ?? "(none)",
    "",
    "## Your private coach note on this learner",
    coachNoteRes.data?.content ?? "(none)",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const system = `You are preparing an executive coach for an UPCOMING 1:1 session with their learner in the LeadShift Leadership Academy. Output a prep doc the coach will read before walking into the session.

Structure (3 short sections, no headings in output):

1. **What's alive right now** — 1-2 sentences naming the single most live thread from the data (a pattern in the reflections, a sprint that's moving, a recent action that's telling). Be specific, cite the learner's words.

2. **Worth opening up** — 2-3 bullets of genuinely open questions for the coach to explore. NOT coaching tips — questions the coach could bring into the session. Ground each in a specific piece of data (e.g., "Their reflection on 2026-04-12 hinted at X — worth probing").

3. **Don't forget** — 1-2 lines flagging any operational items: flagged questions waiting, overdue action items, pre-session notes the learner sent, anything the coach should acknowledge.

Rules:
- Output body only — no greeting, no "here's your prep doc", no sign-off.
- Keep total under 200 words.
- Write in notes-voice (not polished prose). Clipped, scannable.
- Ground every specific in the context. Do NOT invent.
- If a section is genuinely thin, say so honestly — don't pad. "Light activity this window; worth asking what's underneath that."
- Be discreet. This is the coach's prep, not a generic coaching essay.`;

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system,
      prompt: `Context:\n\n${contextBlock}\n\nWrite the prep doc now.`,
      maxOutputTokens: 600,
    });
    const text = result.text.trim();
    if (!text) return { error: "Draft came back empty. Try again." };
    return { draft: text };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Couldn't generate prep: ${err.message}`
          : "Couldn't generate prep.",
    };
  }
}
