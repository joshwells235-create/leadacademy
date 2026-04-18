import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AIUsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: usage } = await supabase.from("ai_usage").select("org_id, user_id, day, model, tokens_in, tokens_out, usd_cents, request_count, organizations:org_id(name), profiles:user_id(display_name)").order("day", { ascending: false }).limit(500);

  // Aggregate by org.
  const byOrg: Record<string, { name: string; requests: number; cost: number; tokensIn: number; tokensOut: number }> = {};
  for (const u of usage ?? []) {
    const orgName = (u.organizations as unknown as { name: string })?.name ?? "Unknown";
    if (!byOrg[u.org_id]) byOrg[u.org_id] = { name: orgName, requests: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
    byOrg[u.org_id].requests += u.request_count;
    byOrg[u.org_id].cost += u.usd_cents;
    byOrg[u.org_id].tokensIn += u.tokens_in;
    byOrg[u.org_id].tokensOut += u.tokens_out;
  }

  // Aggregate by model.
  const byModel: Record<string, { requests: number; cost: number }> = {};
  for (const u of usage ?? []) {
    if (!byModel[u.model]) byModel[u.model] = { requests: 0, cost: 0 };
    byModel[u.model].requests += u.request_count;
    byModel[u.model].cost += u.usd_cents;
  }

  // Top users.
  const byUser: Record<string, { name: string; requests: number; cost: number }> = {};
  for (const u of usage ?? []) {
    const userName = (u.profiles as unknown as { display_name: string | null })?.display_name ?? "Unknown";
    if (!byUser[u.user_id]) byUser[u.user_id] = { name: userName, requests: 0, cost: 0 };
    byUser[u.user_id].requests += u.request_count;
    byUser[u.user_id].cost += u.usd_cents;
  }
  const topUsers = Object.entries(byUser).sort(([, a], [, b]) => b.cost - a.cost).slice(0, 15);

  const totalCost = Object.values(byOrg).reduce((s, o) => s + o.cost, 0);
  const totalRequests = Object.values(byOrg).reduce((s, o) => s + o.requests, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">AI Usage</h1>
      <p className="text-sm text-neutral-600 mb-6">Cross-organization Claude API spend and usage.</p>

      {/* Totals */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-8">
        <Stat label="Total requests" value={totalRequests.toLocaleString()} />
        <Stat label="Total cost" value={`$${(totalCost / 100).toFixed(2)}`} />
        <Stat label="Organizations" value={Object.keys(byOrg).length} />
        <Stat label="Users" value={Object.keys(byUser).length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By org */}
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-brand-navy">By Organization</h2>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase">
              <th className="text-left px-4 py-2 font-medium">Org</th>
              <th className="text-right px-3 py-2 font-medium">Requests</th>
              <th className="text-right px-4 py-2 font-medium">Cost</th>
            </tr></thead>
            <tbody>
              {Object.entries(byOrg).sort(([, a], [, b]) => b.cost - a.cost).map(([id, o]) => (
                <tr key={id} className="border-b border-neutral-50 hover:bg-brand-light">
                  <td className="px-4 py-2 text-brand-navy">{o.name}</td>
                  <td className="text-right px-3 py-2">{o.requests.toLocaleString()}</td>
                  <td className="text-right px-4 py-2 font-medium">${(o.cost / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By model */}
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-navy mb-3">By Model</h2>
            {Object.entries(byModel).map(([model, m]) => (
              <div key={model} className="flex items-center justify-between py-1.5 border-b border-neutral-50 last:border-0">
                <span className="text-sm font-mono text-brand-navy">{model}</span>
                <span className="text-sm">{m.requests.toLocaleString()} req · <span className="font-medium">${(m.cost / 100).toFixed(2)}</span></span>
              </div>
            ))}
          </div>

          {/* Top users */}
          <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-brand-navy">Top Users by Cost</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {topUsers.map(([id, u]) => (
                  <tr key={id} className="border-b border-neutral-50 hover:bg-brand-light">
                    <td className="px-4 py-2 text-brand-navy">{u.name}</td>
                    <td className="text-right px-3 py-2 text-neutral-500">{u.requests} req</td>
                    <td className="text-right px-4 py-2 font-medium">${(u.cost / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-brand-navy">{value}</div>
    </div>
  );
}
