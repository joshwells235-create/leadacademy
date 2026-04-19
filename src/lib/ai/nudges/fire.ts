import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/types/database";
import type { NudgeCandidate } from "./types";

/**
 * Persist a nudge: inserts a `notifications` row (admin client — learners
 * have no insert policy) and a linked `coach_nudges` row. Returns the
 * nudge id on success, null on failure.
 *
 * The notification `link` points at /coach-chat/from-nudge/<nudge_id>,
 * which resolves the nudge into a seeded coach-chat conversation on click.
 */
export async function fireNudge(args: {
  userScoped: SupabaseClient<Database>;
  userId: string;
  orgId: string;
  candidate: NudgeCandidate;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: notification, error: notifError } = await admin
    .from("notifications")
    .insert({
      user_id: args.userId,
      type: `coach_nudge:${args.candidate.pattern}`,
      title: args.candidate.title,
      body: args.candidate.body,
      link: null, // set after we have the nudge id
    })
    .select("id")
    .single();
  if (notifError || !notification) return null;

  const { data: nudge, error: nudgeError } = await admin
    .from("coach_nudges")
    .insert({
      org_id: args.orgId,
      user_id: args.userId,
      pattern: args.candidate.pattern,
      pattern_data: args.candidate.patternData as unknown as Json,
      target_id: args.candidate.targetId,
      notification_id: notification.id,
    })
    .select("id")
    .single();
  if (nudgeError || !nudge) {
    // Rollback the notification so we don't leave a dangling, unlinked card.
    await admin.from("notifications").delete().eq("id", notification.id);
    return null;
  }

  await admin
    .from("notifications")
    .update({ link: `/coach-chat/from-nudge/${nudge.id}` })
    .eq("id", notification.id);

  return nudge.id;
}
