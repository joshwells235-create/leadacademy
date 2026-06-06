import Link from "next/link";
import { notFound } from "next/navigation";
import { humanizeAction } from "@/lib/super/humanize-action";
import { humanizePath } from "@/lib/super/humanize-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type JourneyEvent, JourneyTimeline } from "./journey-timeline";
import { UserEditPanels } from "./user-edit-panels";

type Props = { params: Promise<{ userId: string }> };

export default async function SuperUserDetailPage({ params }: Props) {
  const { userId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: authUserRes } = await admin.auth.admin.getUserById(userId);
  const authUser = authUserRes?.user;
  if (!authUser) notFound();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const [profileRes, membershipsRes, orgsRes, cohortsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, role_title, function_area, industry, company_size, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, context_notes, super_admin, deleted_at, created_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select(
        "id, user_id, org_id, cohort_id, role, status, organizations:org_id(name), cohorts(name)",
      )
      .eq("user_id", userId),
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("cohorts").select("id, name, org_id").order("name"),
  ]);

  const profile = profileRes.data;
  const memberships = (membershipsRes.data ?? []).map((m) => ({
    id: m.id,
    orgId: m.org_id,
    orgName: (m.organizations as unknown as { name: string } | null)?.name ?? "unknown",
    role: m.role,
    status: m.status,
    cohortId: m.cohort_id,
    cohortName: (m.cohorts as unknown as { name: string } | null)?.name ?? null,
  }));

  const orgs = orgsRes.data ?? [];
  const cohorts = cohortsRes.data ?? [];

  const isSelf = viewer?.id === userId;
  const name = profile?.display_name ?? authUser.email ?? "Unnamed";

  // Journey timeline — merge page visits with actions taken. page_views
  // isn't in the generated Database types yet, so the query is narrowly
  // cast. Both reads go through the admin client (super-admin context).
  const [pageViewsRes, actionsRes] = await Promise.all([
    (
      admin.from("page_views" as never) as unknown as {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (
                n: number,
              ) => Promise<{ data: Array<{ path: string; viewed_at: string }> | null }>;
            };
          };
        };
      }
    )
      .select("path, viewed_at")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(120),
    admin
      .from("activity_logs")
      .select("action, target_type, details, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const journeyEvents: JourneyEvent[] = [
    ...(pageViewsRes.data ?? []).map((v) => ({
      kind: "page" as const,
      label: humanizePath(v.path),
      detail: v.path,
      at: v.viewed_at,
    })),
    ...(actionsRes.data ?? []).map((a) => ({
      kind: "action" as const,
      label: humanizeAction(a.action),
      detail: summarizeDetails(a.details),
      at: a.created_at,
    })),
  ]
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex flex-wrap items-center gap-1 text-xs text-neutral-500"
      >
        <Link href="/super/users" className="hover:text-brand-blue">
          Users
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{name}</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-brand-navy">{name}</h1>
          {profile?.super_admin && (
            <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-navy">
              super admin
            </span>
          )}
          {profile?.deleted_at && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              soft-deleted
            </span>
          )}
          {isSelf && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              you
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          User ID <span className="font-mono">{userId}</span> ·{" "}
          {profile?.created_at
            ? `created ${new Date(profile.created_at).toLocaleDateString()}`
            : "created date unknown"}
          {authUser.last_sign_in_at &&
            ` · last sign-in ${new Date(authUser.last_sign_in_at).toLocaleString()}`}
        </p>
      </header>

      <UserEditPanels
        userId={userId}
        email={authUser.email ?? null}
        emailConfirmed={!!authUser.email_confirmed_at}
        isSuperAdmin={profile?.super_admin ?? false}
        deletedAt={profile?.deleted_at ?? null}
        isSelf={isSelf}
        profile={{
          display_name: profile?.display_name ?? null,
          role_title: profile?.role_title ?? null,
          function_area: profile?.function_area ?? null,
          industry: profile?.industry ?? null,
          company_size: profile?.company_size ?? null,
          team_size: profile?.team_size ?? null,
          total_org_influence: profile?.total_org_influence ?? null,
          tenure_at_org: profile?.tenure_at_org ?? null,
          tenure_in_leadership: profile?.tenure_in_leadership ?? null,
          context_notes: profile?.context_notes ?? null,
        }}
        memberships={memberships}
        orgs={orgs}
        cohorts={cohorts}
      />

      <div className="mt-6">
        <JourneyTimeline events={journeyEvents} actorName={name} />
      </div>
    </div>
  );
}

// Compact one-line summary of an activity_logs.details JSON blob for the
// timeline. Picks the most useful key if present.
function summarizeDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.email === "string") parts.push(d.email);
  if (typeof d.name === "string") parts.push(d.name);
  if (typeof d.role === "string") parts.push(`role: ${d.role}`);
  if (typeof d.to === "string") parts.push(`→ ${d.to}`);
  return parts.length ? parts.join(" · ") : null;
}
