import { generateText } from "ai";
import { NextResponse } from "next/server";
import { claude, MODELS } from "@/lib/ai/client";
import { buildLearnerContext } from "@/lib/ai/context/build-learner-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/ai/daily-challenge
 *
 * Returns today's challenge for the authenticated user. If one already exists,
 * returns it. Otherwise, generates a new one using Claude and saves it.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "no membership" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);

  // Check for existing challenge today.
  const { data: existing } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("user_id", user.id)
    .eq("for_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Generate a new challenge.
  const learnerContext = await buildLearnerContext(supabase, user.id);

  // Get recent challenges to avoid repeats.
  const { data: recent } = await supabase
    .from("daily_challenges")
    .select("challenge")
    .eq("user_id", user.id)
    .order("for_date", { ascending: false })
    .limit(7);
  const recentList = (recent ?? []).map((r) => `- ${r.challenge}`).join("\n");

  const { text } = await generateText({
    model: claude(MODELS.sonnet),
    system: `You generate ONE short daily leadership challenge for a participant in a leadership development program. The challenge should be:
- Actionable today (not a multi-day project)
- Specific and behavioral (not "be a better listener" — instead "in your next meeting, let someone finish their full thought before responding")
- Connected to their active goals or recent reflections when possible
- Varied — don't repeat what you've given them recently

Respond with ONLY the challenge text. No preamble, no numbering, no "Today's challenge:". Just the challenge itself in 1-3 sentences.`,
    prompt: `Learner context:
${learnerContext}

Recent challenges to avoid repeating:
${recentList || "(none yet)"}

Generate today's challenge.`,
  });

  const challenge = text.trim();

  const { data: saved, error } = await supabase
    .from("daily_challenges")
    .insert({
      user_id: user.id,
      org_id: membership.org_id,
      challenge,
      for_date: today,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(saved);
}
