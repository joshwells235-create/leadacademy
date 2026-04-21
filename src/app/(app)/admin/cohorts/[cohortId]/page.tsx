import Link from "next/link";
import { notFound } from "next/navigation";
import { labelForRole, roleBadgeClass } from "@/lib/admin/roles";
import { createClient } from "@/lib/supabase/server";
import { CohortRosterActions } from "./cohort-roster-actions";

type Props = { params: Promise<{ cohortId: string }> };

export default async function AdminCohortDetailPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["org_admin"])
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem && !profile?.super_admin) notFound();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select(
      "id, org_id, name, description, starts_at, ends_at, capstone_unlocks_at, consultant_user_id",
    )
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) notFound();
  if (mem && cohort.org_id !== mem.org_id && !profile?.super_admin) notFound();

  const [membersRes, allCohortsRes, consultantRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, role, status, profiles:user_id(display_name)")
      .eq("cohort_id", cohortId)
      .eq("status", "active")
      .order("role"),
    supabase.from("cohorts").select("id, name").eq("org_id", cohort.org_id).order("name"),
    cohort.consultant_user_id
      ? supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", cohort.consultant_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  type MemberRow = {
    id: string;
    user_id: string;
    role: string;
    status: string;
    profiles: { display_name: string | null } | null;
  };
  const members = (membersRes.data ?? []) as unknown as MemberRow[];
  const otherCohorts = (allCohortsRes.data ?? []).filter((c) => c.id !== cohortId);
  const consultantName = (consultantRes.data as { display_name: string | null } | null)
    ?.display_name;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center gap-1 text-xs text-neutral-500"
      >
        <Link href="/admin/cohorts" className="hover:text-brand-blue">
          Cohorts
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{cohort.name}</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-brand-navy">{cohort.name}</h1>
          {consultantName && (
            <span
              title="LeadShift consultant assigned to this cohort (set by super-admin)"
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
            >
              Consultant: {consultantName}
            </span>
          )}
        </div>
        {cohort.description && (
          <p className="mt-2 text-sm text-neutral-600">{cohort.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          {cohort.starts_at && <span>Starts {cohort.starts_at}</span>}
          {cohort.ends_at && <span>Ends {cohort.ends_at}</span>}
          {cohort.capstone_unlocks_at && (
            <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 font-medium text-brand-navy">
              Capstone unlocks {cohort.capstone_unlocks_at}
            </span>
          )}
          <span className="font-medium text-neutral-700">
            {members.length} active member{members.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-navy">Members</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Select members to move them to another cohort. Adding new members happens via the People
            tab.
          </p>
        </div>

        {members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            No active members in this cohort. Invite learners and pin them here, or move existing
            learners from another cohort.
          </p>
        ) : (
          <CohortRosterActions
            members={members.map((m) => ({
              membershipId: m.id,
              name: m.profiles?.display_name ?? "Unnamed",
              role: m.role,
              roleLabel: labelForRole(m.role),
              badgeClass: roleBadgeClass(m.role),
            }))}
            cohortId={cohortId}
            otherCohorts={otherCohorts}
          />
        )}
      </section>
    </div>
  );
}
