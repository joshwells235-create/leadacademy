import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgCreateForm } from "./org-create-form";

export default async function OrgsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: orgs } = await supabase.from("organizations").select("id, name, slug, status, created_at").order("created_at", { ascending: false });

  // Get member counts per org.
  const orgIds = (orgs ?? []).map((o) => o.id);
  const { data: members } = orgIds.length > 0
    ? await supabase.from("memberships").select("org_id").in("org_id", orgIds).eq("status", "active")
    : { data: [] };
  const countByOrg: Record<string, number> = {};
  for (const m of members ?? []) { countByOrg[m.org_id] = (countByOrg[m.org_id] ?? 0) + 1; }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Organizations</h1>
          <p className="mt-1 text-sm text-neutral-600">All client organizations on the platform.</p>
        </div>
        <OrgCreateForm />
      </div>

      {(!orgs || orgs.length === 0) ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <h2 className="font-semibold text-brand-navy">No organizations yet</h2>
          <p className="mt-1 text-sm text-neutral-600">Create one to onboard your first client.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/super/orgs/${o.id}`} className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand-blue/30 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-brand-navy">{o.name}</h2>
                    <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                      <span>/{o.slug}</span>
                      <span>{countByOrg[o.id] ?? 0} members</span>
                      <span>Created {new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{o.status}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
