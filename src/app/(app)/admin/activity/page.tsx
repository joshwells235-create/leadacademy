import { createClient } from "@/lib/supabase/server";

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
  if (!mem) return <div className="p-8">No org.</div>;

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("id, action, target_type, target_id, details, created_at, user_id, profiles:user_id(display_name)")
    .eq("org_id", mem.org_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h2 className="text-xl font-bold text-brand-navy mb-6">Activity Log</h2>

      {(!logs || logs.length === 0) ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
            <span className="text-xl">📋</span>
          </div>
          <h3 className="font-semibold text-brand-navy">No activity yet</h3>
          <p className="mt-1 text-sm text-neutral-600">Actions like invitations, role changes, and coach assignments will appear here.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-3 py-2 font-medium">Who</th>
                <th className="text-left px-3 py-2 font-medium">Action</th>
                <th className="text-left px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const who = (log.profiles as unknown as { display_name: string | null })?.display_name ?? "System";
                const details = log.details && typeof log.details === "object" ? log.details as Record<string, unknown> : {};
                return (
                  <tr key={log.id} className="border-b border-neutral-50 hover:bg-brand-light transition">
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString()}{" "}
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-3 font-medium text-brand-navy">{who}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{formatAction(log.action)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-600">
                      {Object.entries(details).map(([k, v]) => (
                        <span key={k} className="mr-2">{k}: <span className="font-medium">{String(v)}</span></span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatAction(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
