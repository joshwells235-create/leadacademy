import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CohortCapstonePanel } from "./cohort-capstone-panel";
import { type OrgMemberRow, OrgMembersList } from "./org-members-list";
import { OrgSettings } from "./org-settings";
import { SuperInvitePanel } from "./super-invite-panel";

type Props = { params: Promise<{ id: string }> };

export default async function OrgDetailPage({ params }: Props) {
  const { id: orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  const [membersRes, cohortsRes, usageRes, superAdminsRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, role, status, cohort_id, cohorts(name), profiles:user_id(display_name)")
      .eq("org_id", orgId)
      .order("created_at"),
    supabase
      .from("cohorts")
      .select("id, name, starts_at, ends_at, capstone_unlocks_at, consultant_user_id")
      .eq("org_id", orgId),
    supabase
      .from("ai_usage")
      .select("tokens_in, tokens_out, usd_cents, request_count, model")
      .eq("org_id", orgId),
    // Super admins are valid consultant candidates regardless of whether
    // they hold a consultant membership in this org — LeadShift super-admins
    // commonly flex into the consultant seat ad-hoc without being invited
    // org-by-org.
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("super_admin", true)
      .is("deleted_at", null),
  ]);

  const members = membersRes.data ?? [];
  const cohorts = cohortsRes.data ?? [];
  const usage = usageRes.data ?? [];

  const seen = new Set<string>();
  const consultantCandidates: { user_id: string; display_name: string | null }[] = [];
  for (const m of members) {
    if (m.role !== "consultant" || m.status !== "active") continue;
    if (seen.has(m.user_id)) continue;
    seen.add(m.user_id);
    consultantCandidates.push({
      user_id: m.user_id,
      display_name:
        (m.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
    });
  }
  for (const s of superAdminsRes.data ?? []) {
    if (seen.has(s.user_id)) continue;
    seen.add(s.user_id);
    consultantCandidates.push({
      user_id: s.user_id,
      display_name: s.display_name ? `${s.display_name} (super)` : "super admin",
    });
  }
  const totalCost = usage.reduce((s, u) => s + u.usd_cents, 0);
  const totalRequests = usage.reduce((s, u) => s + u.request_count, 0);
  const totalTokensIn = usage.reduce((s, u) => s + u.tokens_in, 0);
  const totalTokensOut = usage.reduce((s, u) => s + u.tokens_out, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/orgs" className="hover:text-brand-blue">
          Organizations
        </Link>
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
              <div>
                <div className="text-xs text-neutral-500">Requests</div>
                <div className="text-lg font-bold text-brand-navy">
                  {totalRequests.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Est. cost</div>
                <div className="text-lg font-bold text-brand-navy">
                  ${(totalCost / 100).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Tokens in</div>
                <div className="text-sm font-medium">{(totalTokensIn / 1000).toFixed(1)}K</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Tokens out</div>
                <div className="text-sm font-medium">{(totalTokensOut / 1000).toFixed(1)}K</div>
              </div>
            </div>
          </div>

          <CohortCapstonePanel
            orgId={orgId}
            cohorts={cohorts}
            consultantCandidates={consultantCandidates}
          />
        </div>

        {/* Right: invite + members */}
        <div className="space-y-5">
          <SuperInvitePanel
            orgId={orgId}
            cohorts={cohorts.map((c) => ({ id: c.id, name: c.name }))}
          />
          <OrgMembersList
            orgId={orgId}
            rows={members.map<OrgMemberRow>((m) => ({
              membershipId: m.id,
              userId: m.user_id,
              name:
                (m.profiles as unknown as { display_name: string | null } | null)?.display_name ??
                "Unnamed",
              role: m.role,
              status: m.status,
              cohortId: m.cohort_id,
              cohortName: m.cohorts?.name ?? null,
            }))}
            cohorts={cohorts.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </div>
    </div>
  );
}
