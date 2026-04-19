import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Tone = "info" | "warning" | "success";

export type VisibleAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: Tone;
};

/**
 * Resolve which announcements this user should see on their dashboard.
 * Matches announcements by scope (global / org they're in / cohort
 * they're in / role they hold), filters out ones they've already
 * dismissed, and sorts newest-first. Announcements already past their
 * `ends_at` are excluded by the RLS read policy.
 */
export async function getVisibleAnnouncements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<VisibleAnnouncement[]> {
  const [memRes, dismissRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("org_id, cohort_id, role")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("announcement_dismissals").select("announcement_id").eq("user_id", userId),
  ]);

  const memberships = memRes.data ?? [];
  const dismissedIds = new Set((dismissRes.data ?? []).map((d) => d.announcement_id));

  const orgIds = Array.from(new Set(memberships.map((m) => m.org_id)));
  const cohortIds = Array.from(
    new Set(memberships.map((m) => m.cohort_id).filter((id): id is string => !!id)),
  );
  const roles = Array.from(new Set(memberships.map((m) => m.role)));

  const { data: anns } = await supabase
    .from("announcements")
    .select("id, scope, org_id, cohort_id, role, title, body, tone, starts_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const now = new Date().toISOString();
  const visible: VisibleAnnouncement[] = [];
  for (const a of anns ?? []) {
    if (a.starts_at > now) continue;
    if (dismissedIds.has(a.id)) continue;
    const matches =
      a.scope === "global" ||
      (a.scope === "org" && a.org_id && orgIds.includes(a.org_id)) ||
      (a.scope === "cohort" && a.cohort_id && cohortIds.includes(a.cohort_id)) ||
      (a.scope === "role" && a.role && roles.includes(a.role));
    if (!matches) continue;
    visible.push({
      id: a.id,
      title: a.title,
      body: a.body,
      tone: a.tone as Tone,
    });
  }
  return visible;
}
