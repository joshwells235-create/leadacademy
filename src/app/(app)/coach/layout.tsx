import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["coach", "org_admin"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership && !profile?.super_admin) redirect("/dashboard");

  return <>{children}</>;
}
