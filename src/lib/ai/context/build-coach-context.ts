import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Args = {
  supabase: SupabaseClient<Database>;
  coachUserId: string;
  /**
   * If set, the conversation is scoped to a single coachee — the context
   * assembled will be a deep-dive on that learner. Otherwise we render a
   * caseload overview with a short summary per coachee.
   */
  learnerUserId?: string;
};

const MAX_COACHEES_IN_OVERVIEW = 12;
const RECENT_ACTIONS_LIMIT = 8;
const RECENT_REFLECTIONS_LIMIT = 5;
const COACH_NOTES_LIMIT = 5;
const COACH_MEMORY_LIMIT = 10;
const COACH_JOURNAL_LIMIT = 10;

/**
 * Builds the Coach context block injected into every turn of a
 * coach_partner-mode conversation. Two shapes:
 *
 * - Caseload-level (no learnerUserId): one block per coachee with current
 *   sprint, since-last-recap signal, flagged-question count. Think: "the
 *   coach scanning their whole caseload before Monday."
 *
 * - Learner-scoped (learnerUserId set): deep-dive on one coachee — goals,
 *   active sprint, recent actions, reflections, assessment themes, last
 *   recap, open action items, coach notes. Think: "the coach prepping for
 *   a session with this specific person."
 */
export async function buildCoachContext(args: Args): Promise<string> {
  const { supabase, coachUserId, learnerUserId } = args;
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const lines: string[] = [];
  lines.push(`Today: ${todayIso} (${weekday}). Use this for any date math.`);

  // Coach identity.
  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", coachUserId)
    .maybeSingle();
  const coachName = coachProfile?.display_name ?? "the coach";
  lines.push(`Coach: ${coachName}.`);

  // Coach's own memory facts (coaching style, preferences). Reuses the
  // learner_memory table — facts keyed by user_id land against whoever
  // created them. Phase 2 reads; Phase 2b will wire distillation on the
  // coach_partner conversations.
  const { data: coachMemory } = await supabase
    .from("learner_memory")
    .select("content, type")
    .eq("user_id", coachUserId)
    .eq("deleted_by_user", false)
    .order("updated_at", { ascending: false })
    .limit(COACH_MEMORY_LIMIT);
  if (coachMemory && coachMemory.length > 0) {
    lines.push("");
    lines.push("## About this coach's practice");
    for (const m of coachMemory) {
      lines.push(`- [${m.type}] ${m.content}`);
    }
  }

  // Coach's own journal — their voice between sessions. Top N most recent,
  // each clipped so a single long entry doesn't blow the context budget.
  // Reading these lets the Thought Partner pick up a thread the coach
  // flagged last week ("wanted to sit with silence with Chen") without
  // the coach re-explaining.
  const { data: coachJournal } = await supabase
    .from("coach_journal_entries")
    .select("content, themes, entry_date")
    .eq("coach_user_id", coachUserId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(COACH_JOURNAL_LIMIT);
  if (coachJournal && coachJournal.length > 0) {
    lines.push("");
    lines.push("## Coach's recent journal entries (private to the coach)");
    for (const j of coachJournal) {
      const content = j.content.length > 400 ? `${j.content.slice(0, 400)}…` : j.content;
      const themes =
        Array.isArray(j.themes) && j.themes.length > 0 ? ` [themes: ${j.themes.join(", ")}]` : "";
      lines.push(`- ${j.entry_date}: ${content}${themes}`);
    }
  }

  // Caseload: all active assignments.
  const { data: assignments } = await supabase
    .from("coach_assignments")
    .select("learner_user_id, active_from, cohorts(id, name)")
    .eq("coach_user_id", coachUserId)
    .is("active_to", null);

  const learnerIds = (assignments ?? []).map((a) => a.learner_user_id);

  if (learnerIds.length === 0) {
    lines.push("");
    lines.push("## Caseload");
    lines.push("No active coachees assigned. The coach is thinking about their practice in general.");
    return lines.join("\n");
  }

  if (learnerUserId && learnerIds.includes(learnerUserId)) {
    // Deep-dive on one coachee.
    await appendLearnerDeepDive(lines, supabase, coachUserId, learnerUserId);
    return lines.join("\n");
  }

  // Caseload overview.
  await appendCaseloadOverview(lines, supabase, coachUserId, assignments ?? []);
  return lines.join("\n");
}

async function appendCaseloadOverview(
  lines: string[],
  supabase: SupabaseClient<Database>,
  coachUserId: string,
  assignments: Array<{
    learner_user_id: string;
    active_from: string | null;
    cohorts: { id: string; name: string | null } | null;
  }>,
) {
  const learnerIds = assignments.map((a) => a.learner_user_id);
  const [profilesRes, goalsRes, sprintsRes, recapsRes, actionItemsRes, flaggedRes] =
    await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", learnerIds),
      supabase
        .from("goals")
        .select("id, user_id, title, status")
        .in("user_id", learnerIds)
        .in("status", ["not_started", "in_progress"]),
      supabase
        .from("goal_sprints")
        .select("user_id, title, practice, planned_end_date, created_at")
        .in("user_id", learnerIds)
        .eq("status", "active"),
      supabase
        .from("session_recaps")
        .select("learner_user_id, content, session_date")
        .eq("coach_user_id", coachUserId)
        .in("learner_user_id", learnerIds)
        .order("session_date", { ascending: false }),
      supabase
        .from("action_items")
        .select("learner_user_id, completed")
        .in("learner_user_id", learnerIds)
        .eq("completed", false),
      supabase
        .from("lesson_questions")
        .select("user_id")
        .in("user_id", learnerIds)
        .not("flagged_to_coach_at", "is", null)
        .is("resolved_at", null),
    ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.display_name]));
  const sprintMap = new Map<
    string,
    { title: string; practice: string; planned_end_date: string | null }
  >();
  for (const s of sprintsRes.data ?? []) {
    sprintMap.set(s.user_id, {
      title: s.title,
      practice: s.practice,
      planned_end_date: s.planned_end_date,
    });
  }
  const latestRecap = new Map<string, { summary: string; session_date: string }>();
  for (const r of recapsRes.data ?? []) {
    if (!latestRecap.has(r.learner_user_id)) {
      latestRecap.set(r.learner_user_id, { summary: r.content ?? "", session_date: r.session_date });
    }
  }
  const openItemsCount = new Map<string, number>();
  for (const it of actionItemsRes.data ?? []) {
    openItemsCount.set(
      it.learner_user_id,
      (openItemsCount.get(it.learner_user_id) ?? 0) + 1,
    );
  }
  const flaggedCount = new Map<string, number>();
  for (const q of flaggedRes.data ?? []) {
    flaggedCount.set(q.user_id, (flaggedCount.get(q.user_id) ?? 0) + 1);
  }

  const activeGoalsCount = new Map<string, number>();
  for (const g of goalsRes.data ?? []) {
    activeGoalsCount.set(g.user_id, (activeGoalsCount.get(g.user_id) ?? 0) + 1);
  }

  lines.push("");
  lines.push(`## Caseload (${assignments.length} active coachee${assignments.length === 1 ? "" : "s"})`);

  const shown = assignments.slice(0, MAX_COACHEES_IN_OVERVIEW);
  for (const a of shown) {
    const name = profileMap.get(a.learner_user_id) ?? "(unnamed coachee)";
    const cohort = a.cohorts?.name ? ` — ${a.cohorts.name}` : "";
    lines.push("");
    lines.push(`### ${name}${cohort}`);
    lines.push(`learner_id: ${a.learner_user_id}`);

    const sprint = sprintMap.get(a.learner_user_id);
    if (sprint) {
      const endNote = sprint.planned_end_date ? ` (ends ${sprint.planned_end_date})` : "";
      lines.push(`- Active sprint: "${sprint.title}" — ${sprint.practice}${endNote}`);
    } else {
      const goalCount = activeGoalsCount.get(a.learner_user_id) ?? 0;
      lines.push(`- No active sprint. ${goalCount} active goal${goalCount === 1 ? "" : "s"}.`);
    }

    const recap = latestRecap.get(a.learner_user_id);
    if (recap) {
      const snippet = recap.summary.slice(0, 200);
      lines.push(`- Last session (${recap.session_date}): ${snippet}${recap.summary.length > 200 ? "…" : ""}`);
    } else {
      lines.push("- No session recaps yet.");
    }

    const items = openItemsCount.get(a.learner_user_id) ?? 0;
    const flagged = flaggedCount.get(a.learner_user_id) ?? 0;
    const signals: string[] = [];
    if (items > 0) signals.push(`${items} open action item${items === 1 ? "" : "s"}`);
    if (flagged > 0) signals.push(`${flagged} flagged question${flagged === 1 ? "" : "s"} waiting`);
    if (signals.length > 0) lines.push(`- Signals: ${signals.join(" · ")}`);
  }

  if (assignments.length > MAX_COACHEES_IN_OVERVIEW) {
    lines.push("");
    lines.push(`(${assignments.length - MAX_COACHEES_IN_OVERVIEW} additional coachees not shown — ask the coach to scope by name or visit /coach/learners/[id].)`);
  }
}

async function appendLearnerDeepDive(
  lines: string[],
  supabase: SupabaseClient<Database>,
  coachUserId: string,
  learnerUserId: string,
) {
  const [
    profileRes,
    membershipRes,
    goalsRes,
    sprintRes,
    actionsRes,
    reflectionsRes,
    recapRes,
    openItemsRes,
    assessmentsRes,
    notesRes,
    flaggedRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, role_title, function_area, team_size, tenure_at_org, tenure_in_leadership, industry, context_notes",
      )
      .eq("user_id", learnerUserId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("cohorts(name), organizations(name)")
      .eq("user_id", learnerUserId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, title, status, primary_lens, target_date, smart_criteria, impact_self, impact_others, impact_org")
      .eq("user_id", learnerUserId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_sprints")
      .select("id, title, practice, created_at, planned_end_date, goal_id")
      .eq("user_id", learnerUserId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("action_logs")
      .select("description, occurred_on, impact_area")
      .eq("user_id", learnerUserId)
      .order("occurred_on", { ascending: false })
      .limit(RECENT_ACTIONS_LIMIT),
    supabase
      .from("reflections")
      .select("content, themes, reflected_on")
      .eq("user_id", learnerUserId)
      .order("reflected_on", { ascending: false })
      .limit(RECENT_REFLECTIONS_LIMIT),
    supabase
      .from("session_recaps")
      .select("content, session_date")
      .eq("coach_user_id", coachUserId)
      .eq("learner_user_id", learnerUserId)
      .order("session_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("action_items")
      .select("title, due_date, completed, description")
      .eq("learner_user_id", learnerUserId)
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("assessments").select("ai_summary").eq("user_id", learnerUserId).maybeSingle(),
    supabase
      .from("coach_notes")
      .select("content, created_at")
      .eq("coach_user_id", coachUserId)
      .eq("learner_user_id", learnerUserId)
      .order("created_at", { ascending: false })
      .limit(COACH_NOTES_LIMIT),
    supabase
      .from("lesson_questions")
      .select("question, ai_answer, created_at, lesson_id")
      .eq("user_id", learnerUserId)
      .not("flagged_to_coach_at", "is", null)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const profile = profileRes.data;
  const membership = membershipRes.data;
  const name = profile?.display_name ?? "(unnamed coachee)";
  const cohort = membership?.cohorts?.name ?? null;
  const org = membership?.organizations?.name ?? null;

  lines.push("");
  lines.push(`## Coachee deep-dive: ${name}`);
  lines.push(`learner_id: ${learnerUserId}`);
  if (cohort || org) {
    lines.push(`Org: ${org ?? "—"}${cohort ? ` · Cohort: ${cohort}` : ""}`);
  }

  if (
    profile?.role_title ||
    profile?.function_area ||
    profile?.team_size ||
    profile?.tenure_at_org ||
    profile?.tenure_in_leadership ||
    profile?.industry ||
    profile?.context_notes
  ) {
    lines.push("");
    lines.push("### About this leader");
    if (profile.role_title) lines.push(`- Role: ${profile.role_title}`);
    if (profile.function_area) lines.push(`- Function: ${profile.function_area}`);
    if (profile.team_size != null) lines.push(`- Team size: ${profile.team_size}`);
    if (profile.tenure_at_org) lines.push(`- Tenure at org: ${profile.tenure_at_org}`);
    if (profile.tenure_in_leadership) lines.push(`- Tenure as a leader: ${profile.tenure_in_leadership}`);
    if (profile.industry) lines.push(`- Industry: ${profile.industry}`);
    if (profile.context_notes) lines.push(`- Context notes: ${profile.context_notes}`);
  }

  const goals = goalsRes.data ?? [];
  if (goals.length > 0) {
    lines.push("");
    lines.push("### Goals");
    for (const g of goals) {
      lines.push(`- [${g.status}] "${g.title}" (goal_id: ${g.id}${g.target_date ? `, target ${g.target_date}` : ""})`);
      if (g.smart_criteria) lines.push(`  SMART: ${String(g.smart_criteria).slice(0, 300)}`);
      if (g.impact_self) lines.push(`  Self: ${g.impact_self.slice(0, 200)}`);
      if (g.impact_others) lines.push(`  Others: ${g.impact_others.slice(0, 200)}`);
      if (g.impact_org) lines.push(`  Org: ${g.impact_org.slice(0, 200)}`);
    }
  }

  const sprint = sprintRes.data;
  if (sprint) {
    lines.push("");
    lines.push("### Active sprint");
    lines.push(`"${sprint.title}" — ${sprint.practice}`);
    const sprintStart = sprint.created_at ? sprint.created_at.slice(0, 10) : null;
    if (sprintStart) {
      lines.push(`Started ${sprintStart}${sprint.planned_end_date ? `, ends ${sprint.planned_end_date}` : ""}`);
    }
    if (sprint.goal_id) lines.push(`Against goal_id: ${sprint.goal_id}`);
  }

  const actions = actionsRes.data ?? [];
  if (actions.length > 0) {
    lines.push("");
    lines.push("### Recent actions (most recent first)");
    for (const a of actions) {
      lines.push(`- ${a.occurred_on}: ${a.description.slice(0, 200)}${a.impact_area ? ` [${a.impact_area}]` : ""}`);
    }
  }

  const reflections = reflectionsRes.data ?? [];
  if (reflections.length > 0) {
    lines.push("");
    lines.push("### Recent reflections");
    for (const r of reflections) {
      const themes = Array.isArray(r.themes) && r.themes.length > 0 ? ` [themes: ${r.themes.join(", ")}]` : "";
      lines.push(`- ${r.reflected_on}: ${r.content.slice(0, 300)}${r.content.length > 300 ? "…" : ""}${themes}`);
    }
  }

  const recap = recapRes.data;
  if (recap) {
    lines.push("");
    lines.push(`### Last session recap (${recap.session_date})`);
    lines.push(recap.content ?? "");
  }

  const openItems = openItemsRes.data ?? [];
  if (openItems.length > 0) {
    lines.push("");
    lines.push("### Open action items (assigned to learner by this coach)");
    for (const it of openItems) {
      lines.push(`- ${it.due_date ? `[due ${it.due_date}] ` : ""}${it.title}${it.description ? ` — ${it.description.slice(0, 150)}` : ""}`);
    }
  }

  const assessmentSummary = assessmentsRes.data?.ai_summary;
  if (assessmentSummary && typeof assessmentSummary === "object") {
    const combined = (assessmentSummary as { _combined_themes?: unknown })._combined_themes;
    if (typeof combined === "string" && combined.length > 0) {
      lines.push("");
      lines.push("### Combined assessment themes");
      lines.push(combined.slice(0, 1200));
    }
  }

  const notes = notesRes.data ?? [];
  if (notes.length > 0) {
    lines.push("");
    lines.push("### Your recent coach notes on this coachee");
    for (const n of notes) {
      lines.push(`- ${n.created_at.slice(0, 10)}: ${n.content.slice(0, 300)}${n.content.length > 300 ? "…" : ""}`);
    }
  }

  const flagged = flaggedRes.data ?? [];
  if (flagged.length > 0) {
    lines.push("");
    lines.push("### Flagged questions waiting on you");
    for (const q of flagged) {
      lines.push(`- "${q.question.slice(0, 200)}"${q.ai_answer ? ` (AI drafted: ${q.ai_answer.slice(0, 200)}${q.ai_answer.length > 200 ? "…" : ""})` : ""}`);
    }
  }
}
