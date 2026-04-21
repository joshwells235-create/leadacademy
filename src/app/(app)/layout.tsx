import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { AmbientGlow } from "@/components/design/ambient-glow";
import { DEFAULT_THEME_MODE, isThemeMode } from "@/lib/design/tokens";

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
    supabase
      .from("profiles")
      .select("display_name, super_admin, theme_mode")
      .eq("user_id", user.id)
      .maybeSingle(),
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

  // Short mono-voiced date string for the brand-lockup chrome.
  // Matches the design prototype's "TUE 21 APR" convention.
  // Rendered in Intl so the weekday name follows the user's locale
  // while staying short.
  const now = new Date();
  const dateLabel = now
    .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();

  const themeMode = isThemeMode(profile?.theme_mode)
    ? profile.theme_mode
    : DEFAULT_THEME_MODE;

  return (
    // Relative + overflow-hidden so the ambient aurora (Cinematic only)
    // stays behind the content and doesn't leak outside the viewport.
    // zIndex on the chrome + main ensures the glow sits beneath them.
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ background: "var(--t-bg)" }}
    >
      {/* Ambient aurora — always mounted, gated visible by CSS on
          [data-theme="cinematic"]. Mounting unconditionally lets the
          client-side mode toggle fade the glow in / out without a
          server round-trip. Opacity defaults to 0 in Editorial so
          there's no alpha cost there. */}
      <AmbientGlow />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <TopNav
          userId={user.id}
          userEmail={user.email ?? ""}
          displayName={profile?.display_name ?? null}
          superAdmin={profile?.super_admin ?? false}
          unreadNotifications={unreadNotifications ?? 0}
          capstoneAvailable={capstoneAvailable}
          isConsultant={isConsultant}
          coachPrimary={coachPrimary}
          themeMode={themeMode}
          dateLabel={dateLabel}
          memberships={
            memberships?.map((m) => ({
              id: m.id,
              role: m.role,
              org: m.organizations,
            })) ?? []
          }
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
