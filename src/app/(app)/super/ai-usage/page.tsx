import { createClient } from "@/lib/supabase/server";
import { UsageFilterBar } from "./filter-bar";

function sinceDay(range: string | undefined): string | null {
  const now = new Date();
  if (range === "7d")
    return new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (range === "90d")
    return new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (range === "mtd")
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  if (range === "all") return null;
  return new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

type Props = {
  searchParams: Promise<{ range?: string; org?: string }>;
};

export default async function AIUsagePage({ searchParams }: Props) {
  const supabase = await createClient();
  const params = await searchParams;
  const range = params.range ?? "30d";
  const orgFilter = params.org ?? "all";
  const since = sinceDay(range);

  const orgsList = await supabase.from("organizations").select("id, name").order("name");

  // Paginate through the full range; supabase caps 1000 rows per request by default.
  const PAGE = 1000;
  const allRows: Array<{
    org_id: string;
    user_id: string;
    day: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
    usd_cents: number;
    request_count: number;
    organizations: { name: string } | null;
    profiles: { display_name: string | null } | null;
  }> = [];
  let page = 0;
  // Hard cap at 10,000 rows (safety against runaway scans).
  const MAX_ROWS = 10_000;
  while (allRows.length < MAX_ROWS) {
    let q = supabase
      .from("ai_usage")
      .select(
        "org_id, user_id, day, model, tokens_in, tokens_out, usd_cents, request_count, organizations:org_id(name), profiles:user_id(display_name)",
      )
      .order("day", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (since) q = q.gte("day", since);
    if (orgFilter !== "all") q = q.eq("org_id", orgFilter);
    const { data } = await q;
    if (!data || data.length === 0) break;
    for (const row of data) {
      allRows.push(row as unknown as (typeof allRows)[number]);
    }
    if (data.length < PAGE) break;
    page += 1;
  }
  const truncated = allRows.length >= MAX_ROWS;

  // Aggregate by org.
  const byOrg: Record<
    string,
    { name: string; requests: number; cost: number; tokensIn: number; tokensOut: number }
  > = {};
  for (const u of allRows) {
    const orgName = u.organizations?.name ?? "Unknown";
    if (!byOrg[u.org_id])
      byOrg[u.org_id] = { name: orgName, requests: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
    byOrg[u.org_id].requests += u.request_count;
    byOrg[u.org_id].cost += u.usd_cents;
    byOrg[u.org_id].tokensIn += u.tokens_in;
    byOrg[u.org_id].tokensOut += u.tokens_out;
  }

  // Aggregate by model.
  const byModel: Record<string, { requests: number; cost: number }> = {};
  for (const u of allRows) {
    if (!byModel[u.model]) byModel[u.model] = { requests: 0, cost: 0 };
    byModel[u.model].requests += u.request_count;
    byModel[u.model].cost += u.usd_cents;
  }

  // Aggregate by day (trend).
  const byDay: Record<string, { requests: number; cost: number }> = {};
  for (const u of allRows) {
    if (!byDay[u.day]) byDay[u.day] = { requests: 0, cost: 0 };
    byDay[u.day].requests += u.request_count;
    byDay[u.day].cost += u.usd_cents;
  }
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const maxDayCost = Math.max(...dayEntries.map(([, d]) => d.cost), 1);

  // Top users.
  const byUser: Record<string, { name: string; requests: number; cost: number }> = {};
  for (const u of allRows) {
    const userName = u.profiles?.display_name ?? "Unknown";
    if (!byUser[u.user_id]) byUser[u.user_id] = { name: userName, requests: 0, cost: 0 };
    byUser[u.user_id].requests += u.request_count;
    byUser[u.user_id].cost += u.usd_cents;
  }
  const topUsers = Object.entries(byUser)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 15);

  const totalCost = Object.values(byOrg).reduce((s, o) => s + o.cost, 0);
  const totalRequests = Object.values(byOrg).reduce((s, o) => s + o.requests, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">AI Usage</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Cross-organization Claude API spend and usage.
      </p>

      <UsageFilterBar orgs={orgsList.data ?? []} />

      {truncated && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Showing first {MAX_ROWS.toLocaleString()} rows. Narrow the date range or filter by org for
          complete aggregates.
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-8">
        <Stat label="Total requests" value={totalRequests.toLocaleString()} />
        <Stat label="Total cost" value={`$${(totalCost / 100).toFixed(2)}`} />
        <Stat label="Organizations" value={Object.keys(byOrg).length} />
        <Stat label="Users" value={Object.keys(byUser).length} />
      </div>

      {dayEntries.length > 0 && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-navy mb-3">Daily spend</h2>
          <div className="flex items-end gap-0.5 h-24">
            {dayEntries.map(([day, d]) => (
              <div
                key={day}
                className="flex-1 flex flex-col items-center justify-end gap-0.5"
                title={`${day}: $${(d.cost / 100).toFixed(2)} · ${d.requests} req`}
              >
                <div
                  className="w-full bg-brand-blue/70 rounded-sm hover:bg-brand-blue transition"
                  style={{ height: `${Math.max(2, (d.cost / maxDayCost) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-500">
            <span>{dayEntries[0]?.[0]}</span>
            <span>{dayEntries[dayEntries.length - 1]?.[0]}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-brand-navy">By Organization</h2>
          </div>
          {Object.keys(byOrg).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              No usage in this range.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase">
                  <th className="text-left px-4 py-2 font-medium">Org</th>
                  <th className="text-right px-3 py-2 font-medium">Requests</th>
                  <th className="text-right px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byOrg)
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([id, o]) => (
                    <tr key={id} className="border-b border-neutral-50 hover:bg-brand-light">
                      <td className="px-4 py-2 text-brand-navy">{o.name}</td>
                      <td className="text-right px-3 py-2">{o.requests.toLocaleString()}</td>
                      <td className="text-right px-4 py-2 font-medium">
                        ${(o.cost / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-navy mb-3">By Model</h2>
            {Object.keys(byModel).length === 0 ? (
              <p className="text-sm text-neutral-500">No model usage in this range.</p>
            ) : (
              Object.entries(byModel).map(([model, m]) => (
                <div
                  key={model}
                  className="flex items-center justify-between py-1.5 border-b border-neutral-50 last:border-0"
                >
                  <span className="text-sm font-mono text-brand-navy">{model}</span>
                  <span className="text-sm">
                    {m.requests.toLocaleString()} req ·{" "}
                    <span className="font-medium">${(m.cost / 100).toFixed(2)}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-brand-navy">Top Users by Cost</h2>
            </div>
            {topUsers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                No user activity in this range.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {topUsers.map(([id, u]) => (
                    <tr key={id} className="border-b border-neutral-50 hover:bg-brand-light">
                      <td className="px-4 py-2 text-brand-navy">{u.name}</td>
                      <td className="text-right px-3 py-2 text-neutral-500">{u.requests} req</td>
                      <td className="text-right px-4 py-2 font-medium">
                        ${(u.cost / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-brand-navy">{value}</div>
    </div>
  );
}
