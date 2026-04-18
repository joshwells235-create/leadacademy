import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExportButtons } from "./export-buttons";

export default async function ExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: orgs } = await supabase.from("organizations").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">Data Export</h1>
      <p className="text-sm text-neutral-600 mb-6">Export data as CSV for reporting, analysis, or client deliverables.</p>

      <ExportButtons orgs={orgs ?? []} />
    </div>
  );
}
