"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSeededCoachPartnerConversation } from "./start-session";

/**
 * Server action bound to the "Think this through with Thought Partner" and
 * "Plan your week" CTAs. Validates the caller is a coach (and coaches the
 * learner if scoped), creates a seeded conversation, redirects to the
 * `/coach-chat?c=<id>` URL.
 *
 * Pass `learnerId` for a learner-scoped prep session. Omit for a
 * caseload-level conversation.
 */
export async function startCoachPartnerSessionAction(learnerId?: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Caller must be a coach (at least one active assignment).
  const { data: anyAssignment } = await supabase
    .from("coach_assignments")
    .select("id")
    .eq("coach_user_id", user.id)
    .is("active_to", null)
    .limit(1)
    .maybeSingle();
  if (!anyAssignment) redirect("/coach/dashboard");

  // If learner-scoped, caller must coach that specific learner.
  if (learnerId) {
    const { data: assignment } = await supabase
      .from("coach_assignments")
      .select("id")
      .eq("coach_user_id", user.id)
      .eq("learner_user_id", learnerId)
      .is("active_to", null)
      .maybeSingle();
    if (!assignment) redirect("/coach/dashboard");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/coach/dashboard");

  const conversationId = await createSeededCoachPartnerConversation({
    supabase,
    coachUserId: user.id,
    orgId: membership.org_id,
    learnerId,
  });

  if (!conversationId) redirect("/coach/dashboard");
  redirect(`/coach-chat?c=${conversationId}`);
}
