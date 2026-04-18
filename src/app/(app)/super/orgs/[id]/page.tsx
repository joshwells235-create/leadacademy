import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgSettings } from "./org-settings";

type Props = { params: Promise<{ id: string }> };

export default async function OrgDetailPage({ params }: Props) {
  const { id: orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (!org) notFound();

  const [membersRes, cohortsRes, usageRes] = await Promise.all([
    supabase.from("memberships").select("id, user_id, role, status, cohort_id, cohorts(name), profiles:user_id(display_name)").eq("org_id", orgId).order("created_at"),
    supabase.from("cohorts").select("id, name, starts_at, ends_at").eq("org_id", orgId),
    supabase.from("ai_usage").select("tokens_in, tokens_out, usd_cents, request_count, model").eq("org_id", orgId),
  ]);

  const members = membersRes.data ?? [];
  const cohorts = cohortsRes.data ?? [];
  const usage = usageRes.data ?? [];
  const totalCost = usage.reduce((s, u) => s + u.usd_cents, 0);
  const totalRequests = usage.reduce((s, u) => s + u.request_count, 0);
  const totalTokensIn = usage.reduce((s, u) => s + u.tokens_in, 0);
  const totalTokensOut = usage.reduce((s, u) => s + u.tokens_out, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/orgs" className="hover:text-brand-blue">Organizations</Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{org.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: settings + stats */}
        <div className="space-y-5">
          <OrgSettings org={org} />

          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-navy mb-3">AI Usage (all time)</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-neutral-500">Requests</div><div className="text-lg font-bold text-brand-navy">{totalRequests.toLocaleString()}</div></div>
              <div><div className="text-xs text-neutral-500">Est. cost</div><div className="text-lg font-bold text-brand-navy">${(totalCost / 100).toFixed(2)}</div></div>
              <div><div className="text-xs text-neutral-500">Tokens in</div><div className="text-sm font-medium">{(totalTokensIn / 1000).toFixed(1)}K</div></div>
              <div><div className="text-xs text-neutral-500">Tokens out</div><div className="text-sm font-medium">{(totalTokensOut / 1000).toFixed(1)}K</div></div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-brand-navy">Cohorts ({cohorts.length})</h2>
              <Link href={`/super/orgs/${orgId}/assign-courses`} className="text-xs text-brand-blue hover:underline">Assign courses →</Link>
            </div>
            {cohorts.length === 0 ? <p className="text-xs text-neutral-500">No cohorts.</p> : (
              <ul className="space-y-1">
                {cohorts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm py-1">
                    <span className="text-brand-navy">{c.name}</span>
                    <span className="text-xs text-neutral-500">{c.starts_at ?? ""} → {c.ends_at ?? ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: members */}
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-brand-navy">Members ({members.length})</h2>
          </div>
          <ul className="divide-y divide-neutral-50">
            {members.map((m) => {
              const name = (m.profiles as unknown as { display_name: string | null })?.display_name ?? "Unnamed";
              return (
                <li key={m.id} className="px-4 py-3 flex items-center justify-between hover:bg-brand-light transition">
                  <div>
                    <Link href={`/super/orgs/${orgId}/members/${m.user_id}`} className="text-sm font-medium text-brand-navy hover:text-brand-blue">{name}</Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m.role === "org_admin" ? "bg-brand-pink-light text-brand-pink" : m.role === "coach" ? "bg-brand-blue-light text-brand-blue" : "bg-neutral-100 text-neutral-600"}`}>{m.role}</span>
                      {m.cohorts?.name && <span className="text-[10px] text-neutral-400">{m.cohorts.name}</span>}
                    </div>
                  </div>
                  <span className={`text-xs ${m.status === "active" ? "text-emerald-600" : "text-neutral-400"}`}>{m.status}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
