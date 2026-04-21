import { redirect } from "next/navigation";
import { labelForRole, roleBadgeClass } from "@/lib/admin/roles";
import { createClient } from "@/lib/supabase/server";
import { CoachLoadPanel, type CoachLoadRow } from "./coach-load-panel";
import { InvitationsPanel, type InviteRow } from "./invitations-panel";
import { InviteForm } from "./invite-form";
import { type AtRiskFlag, type PeopleRow, PeopleTable } from "./people-table";

export default async function PeoplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!mem) return <div className="p-8">No org.</div>;
  const orgId = mem.org_id;

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoIso = fourteenDaysAgo.toISOString().slice(0, 10);
  const fourteenDaysAgoTs = fourteenDaysAgo.toISOString();

  const [
    membersRes,
    cohortsRes,
    assignmentsRes,
    invitationsRes,
    profilesRes,
    actionsRes,
    reflectionsRes,
    aiConvosRes,
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, role, status, cohort_id, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("cohorts").select("id, name").eq("org_id", orgId).order("name"),
    supabase
      .from("coach_assignments")
      .select("coach_user_id, learner_user_id")
      .eq("org_id", orgId)
      .is("active_to", null),
    supabase
      .from("invitations")
      .select("id, email, role, consumed_at, expires_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("user_id, display_name, intake_completed_at"),
    supabase
      .from("action_logs")
      .select("user_id, occurred_on")
      .eq("org_id", orgId)
      .gte("occurred_on", fourteenDaysAgoIso),
    supabase
      .from("reflections")
      .select("user_id, reflected_on")
      .eq("org_id", orgId)
      .gte("reflected_on", fourteenDaysAgoIso),
    supabase
      .from("ai_conversations")
      .select("user_id, last_message_at")
      .eq("org_id", orgId)
      .gte("last_message_at", fourteenDaysAgoTs),
  ]);

  const members = membersRes.data ?? [];
  const cohorts = cohortsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const reflections = reflectionsRes.data ?? [];
  const aiConvos = aiConvosRes.data ?? [];

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p] as const));
  const cohortName = new Map(cohorts.map((c) => [c.id, c.name] as const));
  const coachByLearner = new Map(
    assignments.map((a) => [a.learner_user_id, a.coach_user_id] as const),
  );

  // Build coach name map (from memberships where role = coach/org_admin).
  const coachCandidates = members.filter(
    (m) => (m.role === "coach" || m.role === "org_admin") && m.status === "active",
  );
  const coachOptions = coachCandidates.map((m) => ({
    userId: m.user_id,
    name: profileByUser.get(m.user_id)?.display_name ?? "Unnamed",
  }));
  const coachNameById = new Map(coachOptions.map((c) => [c.userId, c.name] as const));

  // NOTE: emails aren't fetched from auth.users here — org_admin's
  // RLS-scoped client can't read auth schema. Name + internal id are
  // enough to identify members in the current views; when we want email
  // visibility we'll expose a view or use the service-role client.

  // Last activity per user — max of recent actions / reflections / AI convos.
  const lastByUser = new Map<string, string>();
  for (const a of actions) {
    const cur = lastByUser.get(a.user_id);
    if (!cur || a.occurred_on > cur) lastByUser.set(a.user_id, a.occurred_on);
  }
  for (const r of reflections) {
    const cur = lastByUser.get(r.user_id);
    if (!cur || r.reflected_on > cur) lastByUser.set(r.user_id, r.reflected_on);
  }
  for (const c of aiConvos) {
    if (!c.last_message_at) continue;
    const dateOnly = c.last_message_at.slice(0, 10);
    const cur = lastByUser.get(c.user_id);
    if (!cur || dateOnly > cur) lastByUser.set(c.user_id, dateOnly);
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const rows: PeopleRow[] = members.map((m) => {
    const p = profileByUser.get(m.user_id);
    const coachUserId = coachByLearner.get(m.user_id) ?? null;
    const lastActivityDate = lastByUser.get(m.user_id) ?? null;
    const daysSinceActivity = lastActivityDate
      ? Math.floor(
          (new Date(todayIso).getTime() - new Date(lastActivityDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    const flags: AtRiskFlag[] = [];
    if (m.status === "active") {
      if (m.role === "learner" && !coachUserId) flags.push("no-coach");
      if (m.role === "learner" && !p?.intake_completed_at) flags.push("intake-incomplete");
      if (daysSinceActivity == null || daysSinceActivity >= 14) flags.push("no-activity-14d");
    }

    return {
      membershipId: m.id,
      userId: m.user_id,
      name: p?.display_name ?? "Unnamed",
      email: "", // populated separately if/when we expose an email view
      role: m.role,
      roleLabel: labelForRole(m.role),
      roleBadgeClass: roleBadgeClass(m.role),
      cohortId: m.cohort_id,
      cohortName: m.cohort_id ? (cohortName.get(m.cohort_id) ?? null) : null,
      coachUserId,
      coachName: coachUserId ? (coachNameById.get(coachUserId) ?? "Unnamed") : null,
      status: m.status,
      intakeCompleted: !!p?.intake_completed_at,
      lastActivityDate,
      daysSinceActivity,
      atRiskFlags: flags,
    };
  });

  const invites: InviteRow[] = (invitationsRes.data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    consumed_at: i.consumed_at,
    expires_at: i.expires_at,
    created_at: i.created_at,
  }));

  // Coach-load panel rows.
  const coachLoad: CoachLoadRow[] = coachOptions.map((c) => ({
    userId: c.userId,
    name: c.name,
    learnerCount: assignments.filter((a) => a.coach_user_id === c.userId).length,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-navy">People</h2>
        <p className="mt-0.5 text-sm text-neutral-600">
          Invite, organize, and manage everyone in your organization.
        </p>
      </div>

      <InviteForm cohorts={cohorts} />

      <PeopleTable rows={rows} coaches={coachOptions} cohorts={cohorts} />

      {coachLoad.length > 0 && <CoachLoadPanel coaches={coachLoad} />}

      <InvitationsPanel invitations={invites} />
    </div>
  );
}
