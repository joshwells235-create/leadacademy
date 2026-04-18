import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddResourceForm } from "./add-resource-form";

const TYPE_ICONS: Record<string, string> = { article: "📄", video: "🎥", pdf: "📕", tool: "🔧" };

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();

  const { data: resources } = await supabase.from("resources").select("id, title, description, url, type, category, created_at").order("created_at", { ascending: false });

  // Get unique categories for filtering.
  const categories = [...new Set((resources ?? []).map((r) => r.category).filter(Boolean) as string[])].sort();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Resources</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Curated articles, videos, PDFs, and tools to support your leadership growth.
          </p>
        </div>
      </div>

      {profile?.super_admin && <AddResourceForm />}

      {(!resources || resources.length === 0) ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No resources yet. {profile?.super_admin ? "Add the first one above." : "Check back soon."}
        </div>
      ) : (
        <div className="mt-6">
          {/* Category filter chips */}
          {categories.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="text-xs text-neutral-500 py-1">Filter:</span>
              {categories.map((cat) => (
                <span key={cat} className="rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs text-neutral-700">
                  {cat}
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {resources.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-blue/30 hover:shadow-md group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-lg shrink-0">
                  {TYPE_ICONS[r.type] ?? "📎"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-brand-navy group-hover:text-brand-blue transition">{r.title}</h3>
                  {r.description && <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{r.description}</p>}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-400">
                    <span className="rounded-full bg-brand-light px-2 py-0.5">{r.type}</span>
                    {r.category && <span>{r.category}</span>}
                  </div>
                </div>
                <span className="text-xs text-neutral-400 group-hover:text-brand-blue shrink-0 self-center">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
