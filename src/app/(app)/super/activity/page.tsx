import { createClient } from "@/lib/supabase/server";
import { type SuperActivityRow, SuperActivityView } from "./activity-view";

const ROW_LIMIT = 2000;

export default async function SuperActivityPage() {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("activity_logs")
    .select(
      "id, action, target_type, target_id, details, created_at, user_id, org_id, profiles:user_id(display_name), organizations:org_id(name)",
    )
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT);

  type RawLog = {
    id: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: unknown;
    created_at: string;
    user_id: string | null;
    org_id: string | null;
    profiles: { display_name: string | null } | null;
    organizations: { name: string } | null;
  };

  const rows: SuperActivityRow[] = ((logs ?? []) as unknown as RawLog[]).map((l) => ({
    id: l.id,
    action: l.action,
    target_type: l.target_type,
    target_id: l.target_id,
    details:
      l.details && typeof l.details === "object" && !Array.isArray(l.details)
        ? (l.details as Record<string, unknown>)
        : null,
    created_at: l.created_at,
    actor_name: l.profiles?.display_name ?? "System",
    org_id: l.org_id,
    org_name: l.organizations?.name ?? null,
  }));

  const truncated = rows.length >= ROW_LIMIT;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-brand-navy">Cross-org activity log</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Every action across every org — admin and super. Filter by scope, org, actor, action, or
          date. Export CSV for compliance or incident response.
        </p>
      </div>
      {truncated && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Showing the most recent {ROW_LIMIT.toLocaleString()} events. Narrow by date or org for
          older activity.
        </div>
      )}
      <SuperActivityView rows={rows} />
    </div>
  );
}
