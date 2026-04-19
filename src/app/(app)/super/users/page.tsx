import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type UserRow, UsersDirectory } from "./users-directory";

export default async function SuperUsersPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  // auth.admin.listUsers paginates server-side at 1000 max / page. We iterate.
  const authUsers: Array<{
    id: string;
    email: string | null;
    email_confirmed_at: string | null;
    created_at: string;
    last_sign_in_at: string | null;
  }> = [];
  const PER_PAGE = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    const chunk = data?.users ?? [];
    for (const u of chunk) {
      authUsers.push({
        id: u.id,
        email: u.email ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (chunk.length < PER_PAGE) break;
  }

  const [{ data: profiles }, { data: memberships }, { data: orgs }, { data: cohorts }] =
    await Promise.all([
      supabase.from("profiles").select("user_id, display_name, super_admin, deleted_at"),
      supabase.from("memberships").select("user_id, org_id, cohort_id, role, status"),
      supabase.from("organizations").select("id, name"),
      supabase.from("cohorts").select("id, name"),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const orgById = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c.name]));
  const memsByUser = new Map<
    string,
    Array<{ orgId: string; cohortId: string | null; role: string; status: string }>
  >();
  for (const m of memberships ?? []) {
    if (!memsByUser.has(m.user_id)) memsByUser.set(m.user_id, []);
    memsByUser.get(m.user_id)!.push({
      orgId: m.org_id,
      cohortId: m.cohort_id,
      role: m.role,
      status: m.status,
    });
  }

  const rows: UserRow[] = authUsers.map((u) => {
    const profile = profileById.get(u.id);
    const mems = (memsByUser.get(u.id) ?? []).map((m) => ({
      orgId: m.orgId,
      orgName: orgById.get(m.orgId) ?? "unknown",
      role: m.role,
      status: m.status,
      cohortName: m.cohortId ? (cohortById.get(m.cohortId) ?? null) : null,
    }));
    return {
      userId: u.id,
      displayName: profile?.display_name ?? u.email ?? "Unnamed",
      email: u.email,
      emailConfirmed: !!u.email_confirmed_at,
      isSuperAdmin: profile?.super_admin ?? false,
      deletedAt: profile?.deleted_at ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      memberships: mems,
    };
  });

  const activeCount = rows.filter((r) => !r.deletedAt).length;
  const superAdminCount = rows.filter((r) => r.isSuperAdmin).length;
  const unconfirmedCount = rows.filter((r) => !r.emailConfirmed && !r.deletedAt).length;
  const deletedCount = rows.filter((r) => !!r.deletedAt).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-brand-navy">All users</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Global directory across every organization. Click into a user to edit profile, change
          email, reset password, grant/revoke super-admin, move between orgs, or soft-delete.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Stat label="Total users" value={rows.length} sublabel={`${activeCount} active`} />
        <Stat label="Super admins" value={superAdminCount} sublabel="incl. LeadShift staff" />
        <Stat label="Unconfirmed" value={unconfirmedCount} sublabel="never confirmed email" />
        <Stat label="Soft-deleted" value={deletedCount} sublabel="retained for audit" />
      </div>

      <UsersDirectory rows={rows} />
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
