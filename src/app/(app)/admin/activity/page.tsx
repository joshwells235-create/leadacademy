import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActivityLogRow, ActivityView } from "./activity-view";

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return <div className="p-8">No org.</div>;

  const { data: logs } = await supabase
    .from("activity_logs")
    .select(
      "id, action, target_type, target_id, details, created_at, user_id, profiles:user_id(display_name)",
    )
    .eq("org_id", mem.org_id)
    .order("created_at", { ascending: false })
    .limit(500);

  type RawLog = {
    id: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: unknown;
    created_at: string;
    user_id: string | null;
    profiles: { display_name: string | null } | null;
  };

  const rows: ActivityLogRow[] = ((logs ?? []) as unknown as RawLog[]).map((l) => ({
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
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-brand-navy">Activity log</h2>
        <p className="mt-0.5 text-sm text-neutral-600">
          Everything that's happened in this org — invites, role changes, coach assignments,
          archives. Filter, search, export for audit.
        </p>
      </div>
      <ActivityView rows={rows} />
    </div>
  );
}
