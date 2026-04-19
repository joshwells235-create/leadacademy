import { createClient } from "@/lib/supabase/server";
import { type InvitationRow, InvitationsView } from "./invitations-view";

export default async function SuperInvitationsPage() {
  const supabase = await createClient();

  const { data: invitations } = await supabase
    .from("invitations")
    .select(
      "id, email, role, org_id, cohort_id, created_at, expires_at, consumed_at, invited_by, organizations:org_id(name), cohorts(name), profiles:invited_by(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  const nowIso = new Date().toISOString();
  const rows: InvitationRow[] = (invitations ?? []).map((i) => {
    const status: InvitationRow["status"] = i.consumed_at
      ? "consumed"
      : i.expires_at < nowIso
        ? "expired"
        : "pending";
    return {
      id: i.id,
      email: i.email,
      role: i.role,
      status,
      orgId: i.org_id,
      orgName: (i.organizations as unknown as { name: string } | null)?.name ?? "unknown",
      cohortId: i.cohort_id,
      cohortName: (i.cohorts as unknown as { name: string } | null)?.name ?? null,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      consumedAt: i.consumed_at,
      invitedByName:
        (i.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Invitations</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Every invitation ever sent, across every org. Revoke a pending invite to kill the link
          immediately. For bulk operations and resend, use each org's People tab.
        </p>
      </div>
      <InvitationsView rows={rows} />
    </div>
  );
}
