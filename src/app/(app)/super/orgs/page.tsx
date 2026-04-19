import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrgCreateForm } from "./org-create-form";
import { type OrgRow, OrgsList } from "./orgs-list";

export default async function OrgsPage() {
  const supabase = await createClient();

  const [orgsRes, membershipsRes, cohortsRes, invitesRes, coursesRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("memberships").select("org_id, role, user_id, status").eq("status", "active"),
    supabase.from("cohorts").select("id, org_id"),
    supabase
      .from("invitations")
      .select("id, consumed_at, expires_at")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase.from("courses").select("id, status"),
  ]);

  const orgs = orgsRes.data ?? [];
  const memberships = membershipsRes.data ?? [];
  const cohorts = cohortsRes.data ?? [];
  const pendingInvites = invitesRes.data ?? [];
  const courses = coursesRes.data ?? [];

  // AI spend over the last 30 days.
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: usage30 } = await supabase
    .from("ai_usage")
    .select("org_id, user_id, usd_cents, request_count, day")
    .gte("day", since30);
  const usageRows = usage30 ?? [];

  // Learners active in the last 14 days (distinct user_ids with ai_usage entries).
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: usage14 } = await supabase
    .from("ai_usage")
    .select("org_id, user_id")
    .gte("day", since14);
  const activeUsersByOrg = new Map<string, Set<string>>();
  for (const u of usage14 ?? []) {
    if (!activeUsersByOrg.has(u.org_id)) activeUsersByOrg.set(u.org_id, new Set());
    activeUsersByOrg.get(u.org_id)!.add(u.user_id);
  }

  // Aggregates per org.
  const memberByOrg = new Map<string, number>();
  const learnerByOrg = new Map<string, number>();
  for (const m of memberships) {
    memberByOrg.set(m.org_id, (memberByOrg.get(m.org_id) ?? 0) + 1);
    if (m.role === "learner") learnerByOrg.set(m.org_id, (learnerByOrg.get(m.org_id) ?? 0) + 1);
  }
  const cohortByOrg = new Map<string, number>();
  for (const c of cohorts) cohortByOrg.set(c.org_id, (cohortByOrg.get(c.org_id) ?? 0) + 1);
  const spendByOrg = new Map<string, number>();
  for (const u of usageRows)
    spendByOrg.set(u.org_id, (spendByOrg.get(u.org_id) ?? 0) + u.usd_cents);

  const rows: OrgRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    createdAt: o.created_at,
    memberCount: memberByOrg.get(o.id) ?? 0,
    learnerCount: learnerByOrg.get(o.id) ?? 0,
    cohortCount: cohortByOrg.get(o.id) ?? 0,
    activeLast14d: activeUsersByOrg.get(o.id)?.size ?? 0,
    aiSpendCents30d: spendByOrg.get(o.id) ?? 0,
  }));

  // Cross-org totals.
  const activeOrgs = orgs.filter((o) => o.status === "active").length;
  const totalMembers = memberships.length;
  const totalLearners = memberships.filter((m) => m.role === "learner").length;
  const totalActive14d = new Set((usage14 ?? []).map((u) => u.user_id)).size;
  const totalSpend30d = usageRows.reduce((s, u) => s + u.usd_cents, 0);
  const publishedCourses = courses.filter((c) => c.status === "published").length;
  const totalCohorts = cohorts.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Organizations</h1>
          <p className="mt-1 text-sm text-neutral-600">All client organizations on the platform.</p>
        </div>
        <OrgCreateForm />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Stat label="Active orgs" value={activeOrgs} sublabel={`${orgs.length} total`} />
        <Stat label="Members" value={totalMembers} sublabel={`${totalLearners} learners`} />
        <Stat label="Active 14d" value={totalActive14d} sublabel="by AI activity" />
        <Stat
          label="AI spend 30d"
          value={`$${(totalSpend30d / 100).toFixed(2)}`}
          sublabel="all orgs"
        />
        <Stat label="Cohorts" value={totalCohorts} sublabel="across all orgs" />
        <Stat
          label="Published courses"
          value={publishedCourses}
          sublabel={`${courses.length} total`}
        />
        <Stat label="Pending invites" value={pendingInvites.length} sublabel="not yet accepted" />
        <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Cross-org audit
          </div>
          <Link
            href="/super/activity"
            className="mt-1 text-sm font-semibold text-brand-blue hover:underline"
          >
            Activity log →
          </Link>
        </div>
      </div>

      <OrgsList rows={rows} />
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-brand-navy">{value}</div>
      {sublabel && <div className="text-[10px] text-neutral-500">{sublabel}</div>}
    </div>
  );
}
