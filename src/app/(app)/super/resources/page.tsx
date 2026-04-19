import { createClient } from "@/lib/supabase/server";
import { type ResourceRow, ResourcesManager } from "./resources-manager";

export default async function SuperResourcesPage() {
  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resources")
    .select("id, title, description, url, type, category, created_at")
    .order("created_at", { ascending: false });

  const rows: ResourceRow[] = (resources ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
    type: r.type,
    category: r.category,
    createdAt: r.created_at,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Resource library</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Global catalog of articles, videos, worksheets, and templates learners can search in
          <a href="/resources" className="ml-1 text-brand-blue hover:underline">
            /resources
          </a>
          . Edits here propagate immediately.
        </p>
      </div>
      <ResourcesManager rows={rows} />
    </div>
  );
}
