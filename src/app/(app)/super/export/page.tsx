import { createClient } from "@/lib/supabase/server";
import { ExportButtons, type ExportCounts } from "./export-buttons";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function totalRows(
  supabase: Supabase,
  table: "memberships" | "goals" | "action_logs" | "reflections" | "ai_usage" | "lesson_progress",
): Promise<number> {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Bucket rows by `org_id` on tables that carry it. Paginates to avoid
 * Supabase's 1k-row default cap. Capped at 50k rows — if we ever get
 * beyond that we should move to a Postgres function for the aggregate.
 */
async function orgBreakdown(
  supabase: Supabase,
  table: "memberships" | "goals" | "action_logs" | "reflections" | "ai_usage",
): Promise<Record<string, number>> {
  const byOrg: Record<string, number> = {};
  const PAGE = 1000;
  let offset = 0;
  while (offset < 50_000) {
    // biome-ignore lint/suspicious/noExplicitAny: table names typed above but select narrows to per-table Row
    const { data } = await (supabase.from(table) as any)
      .select("org_id")
      .range(offset, offset + PAGE - 1);
    const rows = (data ?? []) as { org_id: string | null }[];
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.org_id) byOrg[row.org_id] = (byOrg[row.org_id] ?? 0) + 1;
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return byOrg;
}

async function lessonProgressOrgBreakdown(supabase: Supabase): Promise<Record<string, number>> {
  // lesson_progress has no org_id; resolve via memberships (user_id → org_id).
  // Do it in two passes: (1) count by user_id from lesson_progress; (2) map
  // those user_ids to an org via memberships.
  const progressByUser: Record<string, number> = {};
  const PAGE = 1000;
  let offset = 0;
  while (offset < 50_000) {
    const { data } = await supabase
      .from("lesson_progress")
      .select("user_id")
      .range(offset, offset + PAGE - 1);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const r of rows) progressByUser[r.user_id] = (progressByUser[r.user_id] ?? 0) + 1;
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  const userIds = Object.keys(progressByUser);
  if (userIds.length === 0) return {};
  // Fetch memberships for these users (one per user for org assignment).
  const orgByUser: Record<string, string> = {};
  const BATCH = 500;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const slice = userIds.slice(i, i + BATCH);
    const { data } = await supabase
      .from("memberships")
      .select("user_id, org_id")
      .in("user_id", slice)
      .eq("status", "active");
    for (const m of data ?? []) {
      if (!orgByUser[m.user_id]) orgByUser[m.user_id] = m.org_id;
    }
  }
  const byOrg: Record<string, number> = {};
  for (const [userId, count] of Object.entries(progressByUser)) {
    const orgId = orgByUser[userId];
    if (orgId) byOrg[orgId] = (byOrg[orgId] ?? 0) + count;
  }
  return byOrg;
}

export default async function ExportPage() {
  const supabase = await createClient();

  const { data: orgs } = await supabase.from("organizations").select("id, name").order("name");

  const [
    membersTotal,
    membersByOrg,
    goalsTotal,
    goalsByOrg,
    actionsTotal,
    actionsByOrg,
    reflectionsTotal,
    reflectionsByOrg,
    usageTotal,
    usageByOrg,
    lessonProgressTotal,
    lessonProgressByOrg,
  ] = await Promise.all([
    totalRows(supabase, "memberships"),
    orgBreakdown(supabase, "memberships"),
    totalRows(supabase, "goals"),
    orgBreakdown(supabase, "goals"),
    totalRows(supabase, "action_logs"),
    orgBreakdown(supabase, "action_logs"),
    totalRows(supabase, "reflections"),
    orgBreakdown(supabase, "reflections"),
    totalRows(supabase, "ai_usage"),
    orgBreakdown(supabase, "ai_usage"),
    totalRows(supabase, "lesson_progress"),
    lessonProgressOrgBreakdown(supabase),
  ]);

  const counts: ExportCounts = {
    members: { total: membersTotal, byOrg: membersByOrg },
    goals: { total: goalsTotal, byOrg: goalsByOrg },
    action_logs: { total: actionsTotal, byOrg: actionsByOrg },
    reflections: { total: reflectionsTotal, byOrg: reflectionsByOrg },
    ai_usage: { total: usageTotal, byOrg: usageByOrg },
    lesson_progress: { total: lessonProgressTotal, byOrg: lessonProgressByOrg },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">Data Export</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Export data as CSV for reporting, analysis, or client deliverables. Row counts shown reflect
        what will be included — pick an org to scope the export.
      </p>

      <ExportButtons orgs={orgs ?? []} counts={counts} />
    </div>
  );
}
