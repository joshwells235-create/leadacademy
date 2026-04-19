import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["org_admin"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership && !profile?.super_admin) redirect("/dashboard");

  const orgName = membership?.organizations?.name ?? "Organization";

  return (
    <div>
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-brand-navy">Admin Portal</h1>
              <p className="text-xs text-neutral-500">{orgName}</p>
            </div>
            <Link href="/dashboard" className="text-xs text-brand-blue hover:underline">
              ← Back to app
            </Link>
          </div>
          <AdminTabs />
        </div>
      </div>
      {children}
    </div>
  );
}
