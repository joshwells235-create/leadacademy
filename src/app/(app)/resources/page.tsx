import { createClient } from "@/lib/supabase/server";
import { AddResourceForm } from "./add-resource-form";
import { ResourceGrid } from "./resource-grid";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();

  const { data: resources } = await supabase.from("resources").select("id, title, description, url, type, category, created_at").order("created_at", { ascending: false });

  const categories = [...new Set((resources ?? []).map((r) => r.category).filter(Boolean) as string[])].sort();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Resources</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Curated articles, videos, PDFs, and tools to support your leadership growth.
        </p>
      </div>

      {profile?.super_admin && <AddResourceForm />}

      {(!resources || resources.length === 0) ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
            <span className="text-xl">📚</span>
          </div>
          <h2 className="font-semibold text-brand-navy">No resources yet</h2>
          <p className="mt-1 text-sm text-neutral-600 max-w-sm mx-auto">
            {profile?.super_admin ? "Add the first resource above." : "Resources will appear here as your program team curates them."}
          </p>
        </div>
      ) : (
        <ResourceGrid resources={resources} categories={categories} />
      )}
    </div>
  );
}
