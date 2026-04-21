import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile },
    { data: memberships },
    { count: unreadNotifications },
    { data: capstoneCohort },
    roleContext,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, super_admin").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("id, role, org_id, organizations(id, name, logo_url, slug)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    supabase
      .from("memberships")
      .select("cohorts(capstone_unlocks_at)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("cohort_id", "is", null)
      .limit(1)
      .maybeSingle(),
    getUserRoleContext(supabase, user.id),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const capstoneAvailable = !!(
    capstoneCohort?.cohorts?.capstone_unlocks_at &&
    capstoneCohort.cohorts.capstone_unlocks_at <= todayIso
  );
  const isConsultant = roleContext.isConsultant;
  const coachPrimary = roleContext.coachPrimary;

  return (
    <div className="min-h-dvh flex flex-col">
      <TopNav
        userId={user.id}
        userEmail={user.email ?? ""}
        displayName={profile?.display_name ?? null}
        superAdmin={profile?.super_admin ?? false}
        unreadNotifications={unreadNotifications ?? 0}
        capstoneAvailable={capstoneAvailable}
        isConsultant={isConsultant}
        coachPrimary={coachPrimary}
        memberships={
          memberships?.map((m) => ({
            id: m.id,
            role: m.role,
            org: m.organizations,
          })) ?? []
        }
      />
      <main className="flex-1 bg-brand-light">{children}</main>
    </div>
  );
}
