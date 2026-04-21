"use server";

import { generateText } from "ai";
import { claude, MODELS } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate a FIRST-DRAFT check-in message from the coach to one of their
 * coachees. Short, warm, specific — references something recent from the
 * learner's activity so the message doesn't feel like a templated ping.
 *
 * Returns text only; the coach edits and sends via the existing
 * sendMessage action. No persistence until they hit send.
 */
export async function generateCheckInDraft(
  learnerId: string,
): Promise<{ draft: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Caller must coach this learner.
  const { data: assignment } = await supabase
    .from("coach_assignments")
    .select("id")
    .eq("coach_user_id", user.id)
    .eq("learner_user_id", learnerId)
    .is("active_to", null)
    .maybeSingle();
  if (!assignment) return { error: "You're not assigned to this learner." };

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const cutoffIso = fourteenDaysAgo.toISOString().slice(0, 10);
  const cutoffTs = fourteenDaysAgo.toISOString();

  const [
    coachProfile,
    learnerProfile,
    latestRecap,
    actionsRes,
    reflectionsRes,
    sprintRes,
    openItemsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("user_id", learnerId).maybeSingle(),
    supabase
      .from("session_recaps")
      .select("session_date, content")
      .eq("coach_user_id", user.id)
      .eq("learner_user_id", learnerId)
      .order("session_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("action_logs")
      .select("description, occurred_on")
      .eq("user_id", learnerId)
      .gte("occurred_on", cutoffIso)
      .order("occurred_on", { ascending: false })
      .limit(6),
    supabase
      .from("reflections")
      .select("content, themes, reflected_on")
      .eq("user_id", learnerId)
      .gte("reflected_on", cutoffIso)
      .order("reflected_on", { ascending: false })
      .limit(3),
    supabase
      .from("goal_sprints")
      .select("title, practice, planned_end_date, action_count")
      .eq("user_id", learnerId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("action_items")
      .select("title, due_date")
      .eq("learner_user_id", learnerId)
      .eq("completed", false)
      .gte("created_at", cutoffTs)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(3),
  ]);

  const coachFirstName = coachProfile.data?.display_name?.split(/\s+/)[0] ?? "your coach";
  const learnerFirstName = learnerProfile.data?.display_name?.split(/\s+/)[0] ?? "there";

  const lines: string[] = [];
  lines.push(`Coach: ${coachFirstName}`);
  lines.push(`Coachee: ${learnerFirstName}`);
  if (latestRecap.data) {
    lines.push(
      `Last session recap (${latestRecap.data.session_date}): ${latestRecap.data.content?.slice(0, 400) ?? ""}`,
    );
  } else {
    lines.push("No session recap yet — this might be an early check-in.");
  }
  if (sprintRes.data) {
    lines.push(
      `Active sprint: "${sprintRes.data.title}" — ${sprintRes.data.practice} (${sprintRes.data.action_count} actions, ends ${sprintRes.data.planned_end_date})`,
    );
  }
  if (actionsRes.data && actionsRes.data.length > 0) {
    lines.push("Recent actions:");
    for (const a of actionsRes.data) {
      lines.push(`- [${a.occurred_on}] ${a.description.slice(0, 180)}`);
    }
  }
  if (reflectionsRes.data && reflectionsRes.data.length > 0) {
    lines.push("Recent reflections:");
    for (const r of reflectionsRes.data) {
      lines.push(
        `- [${r.reflected_on}] ${r.content.slice(0, 200)}${(r.themes ?? []).length > 0 ? ` (themes: ${(r.themes ?? []).join(", ")})` : ""}`,
      );
    }
  }
  if (openItemsRes.data && openItemsRes.data.length > 0) {
    lines.push("Open action items from recent sessions:");
    for (const it of openItemsRes.data) {
      lines.push(`- ${it.title}${it.due_date ? ` (due ${it.due_date})` : ""}`);
    }
  }
  const contextBlock = lines.join("\n");

  const system = `You are drafting a short, warm check-in message from a coach to their coachee in the LeadShift Leadership Academy. The coach will edit before sending.

Rules:
- 2-4 sentences. Short enough to read on a phone between meetings.
- Reference ONE specific, recent piece of the coachee's activity (an action they logged, a reflection they wrote, a sprint practice they committed to). Specific beats warm-and-generic every time.
- Ask ONE open question that invites a reply. Not "how are you?" — something grounded in what you noticed.
- Sign off with the coach's first name (${coachFirstName}).
- Do NOT coach in the message itself. This is a check-in, not a session.
- If the data is sparse (nothing recent from the coachee), lead with that honestly — "quiet week on your end, wanted to check in" — and ask what's going on.
- Output only the message body. No subject line, no preamble like "Here's the draft:", no meta-commentary.
- Never invent specifics.`;

  try {
    const result = await generateText({
      model: claude(MODELS.sonnet),
      system,
      prompt: `Context:\n\n${contextBlock}\n\nDraft the check-in message now.`,
      maxOutputTokens: 250,
    });
    const text = result.text.trim();
    if (!text) return { error: "Draft came back empty. Try again." };
    return { draft: text };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Couldn't generate check-in: ${err.message}`
          : "Couldn't generate check-in.",
    };
  }
}
