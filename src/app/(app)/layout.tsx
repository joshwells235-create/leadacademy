import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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

  // Load the profile + the user's memberships with org info for the top nav.
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name, super_admin").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("id, role, org_id, organizations(id, name, logo_url, slug)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  return (
    <div className="min-h-dvh flex flex-col">
      <TopNav
        userEmail={user.email ?? ""}
        displayName={profile?.display_name ?? null}
        superAdmin={profile?.super_admin ?? false}
        memberships={
          memberships?.map((m) => ({
            id: m.id,
            role: m.role,
            org: m.organizations,
          })) ?? []
        }
      />
      <main className="flex-1 bg-neutral-50">{children}</main>
    </div>
  );
}
