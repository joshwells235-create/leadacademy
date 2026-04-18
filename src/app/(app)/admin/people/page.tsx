import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { MemberActions } from "./member-actions";
import { AssignCoachForm } from "./assign-coach-form";

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: mem } = await supabase.from("memberships").select("org_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
  if (!mem) return <div className="p-8">No org.</div>;

  const [membersRes, cohortsRes, assignmentsRes, invitationsRes] = await Promise.all([
    supabase.from("memberships").select("id, user_id, role, status, cohort_id, cohorts(name), profiles:user_id(display_name)").eq("org_id", mem.org_id).order("created_at"),
    supabase.from("cohorts").select("id, name").eq("org_id", mem.org_id),
    supabase.from("coach_assignments").select("coach_user_id, learner_user_id, profiles:coach_user_id(display_name)").eq("org_id", mem.org_id).is("active_to", null),
    supabase.from("invitations").select("id, email, role, token, consumed_at, expires_at, created_at").eq("org_id", mem.org_id).order("created_at", { ascending: false }).limit(20),
  ]);

  const members = membersRes.data ?? [];
  const cohorts = cohortsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const invitations = invitationsRes.data ?? [];
  const coaches = members.filter((m) => m.role === "coach" || m.role === "org_admin");
  const assignmentMap: Record<string, string> = {};
  for (const a of assignments) {
    const coachName = (a.profiles as unknown as { display_name: string | null })?.display_name;
    if (coachName) assignmentMap[a.learner_user_id] = coachName;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-xl font-bold text-brand-navy">People</h2>
      </div>

      {/* Invite form */}
      <InviteForm cohorts={cohorts} />

      {/* Members table */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-brand-navy">Members ({members.filter((m) => m.status === "active").length} active)</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Role</th>
              <th className="text-left px-3 py-2 font-medium">Cohort</th>
              <th className="text-left px-3 py-2 font-medium">Coach</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const name = (m.profiles as unknown as { display_name: string | null })?.display_name ?? "Unnamed";
              const cohortName = m.cohorts?.name ?? "—";
              const coachName = assignmentMap[m.user_id] ?? "—";
              return (
                <tr key={m.id} className={`border-b border-neutral-50 hover:bg-brand-light transition ${m.status === "archived" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-brand-navy">{name}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.role === "org_admin" ? "bg-brand-pink-light text-brand-pink" :
                      m.role === "coach" ? "bg-brand-blue-light text-brand-blue" :
                      "bg-neutral-100 text-neutral-700"
                    }`}>{m.role}</span>
                  </td>
                  <td className="px-3 py-3 text-neutral-600">{cohortName}</td>
                  <td className="px-3 py-3 text-neutral-600">
                    {m.role === "learner" ? (
                      coachName === "—" ? (
                        <AssignCoachForm learnerId={m.user_id} coaches={coaches.map((c) => ({ id: c.user_id, name: (c.profiles as unknown as { display_name: string | null })?.display_name ?? "Unnamed" }))} />
                      ) : coachName
                    ) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MemberActions membershipId={m.id} currentRole={m.role} status={m.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-brand-navy">Recent Invitations</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-neutral-50">
                  <td className="px-4 py-2 text-brand-navy">{inv.email}</td>
                  <td className="px-3 py-2">{inv.role}</td>
                  <td className="px-3 py-2">
                    {inv.consumed_at
                      ? <span className="text-emerald-600 text-xs">Accepted</span>
                      : new Date(inv.expires_at) < new Date()
                        ? <span className="text-neutral-400 text-xs">Expired</span>
                        : <span className="text-amber-600 text-xs">Pending</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
