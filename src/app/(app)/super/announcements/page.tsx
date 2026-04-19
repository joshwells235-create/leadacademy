import { createClient } from "@/lib/supabase/server";
import { type AnnouncementRow, AnnouncementsManager } from "./announcements-manager";

export default async function SuperAnnouncementsPage() {
  const supabase = await createClient();

  const [annRes, orgsRes, cohortsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select(
        "id, scope, org_id, cohort_id, role, title, body, tone, starts_at, ends_at, created_at, created_by, organizations:org_id(name), cohorts(name), profiles:created_by(display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("cohorts").select("id, name, org_id").order("name"),
  ]);

  const rows: AnnouncementRow[] = (annRes.data ?? []).map((a) => ({
    id: a.id,
    scope: a.scope as AnnouncementRow["scope"],
    orgId: a.org_id,
    orgName: (a.organizations as unknown as { name: string } | null)?.name ?? null,
    cohortId: a.cohort_id,
    cohortName: (a.cohorts as unknown as { name: string } | null)?.name ?? null,
    role: (a.role as AnnouncementRow["role"]) ?? null,
    title: a.title,
    body: a.body,
    tone: a.tone as AnnouncementRow["tone"],
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    createdAt: a.created_at,
    createdByName:
      (a.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Announcements</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Broadcast a banner to everyone, a specific org, a specific cohort, or all users with a
          given role. Shows up on the targeted users' dashboards until they dismiss it or it ends.
        </p>
      </div>

      <AnnouncementsManager rows={rows} orgs={orgsRes.data ?? []} cohorts={cohortsRes.data ?? []} />
    </div>
  );
}
