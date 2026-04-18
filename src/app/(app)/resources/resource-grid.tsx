"use client";

import { useState } from "react";

const TYPE_ICONS: Record<string, string> = { article: "📄", video: "🎥", pdf: "📕", tool: "🔧" };
const TYPE_LABELS: Record<string, string> = { article: "Article", video: "Video", pdf: "PDF", tool: "Tool" };

type Resource = {
  id: string; title: string; description: string | null; url: string;
  type: string; category: string | null; created_at: string;
};

export function ResourceGrid({ resources, categories }: { resources: Resource[]; categories: string[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = resources.filter((r) => {
    if (activeCategory && r.category !== activeCategory) return false;
    if (activeType && r.type !== activeType) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !(r.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const types = [...new Set(resources.map((r) => r.type))].sort();

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources..."
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <div className="flex flex-wrap gap-2">
          {/* Type filters */}
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(activeType === t ? null : t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeType === t
                  ? "bg-brand-blue text-white"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:border-brand-blue hover:text-brand-blue"
              }`}
            >
              {TYPE_ICONS[t]} {TYPE_LABELS[t] ?? t}
            </button>
          ))}
          {types.length > 0 && categories.length > 0 && <span className="text-neutral-300 self-center">|</span>}
          {/* Category filters */}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeCategory === cat
                  ? "bg-brand-navy text-white"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:border-brand-navy hover:text-brand-navy"
              }`}
            >
              {cat}
            </button>
          ))}
          {(activeCategory || activeType || search) && (
            <button
              onClick={() => { setActiveCategory(null); setActiveType(null); setSearch(""); }}
              className="rounded-full px-3 py-1 text-xs text-neutral-500 hover:text-brand-pink transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No resources match your filters.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((r) => (
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
                  <span className="rounded-full bg-brand-light px-2 py-0.5">{TYPE_LABELS[r.type] ?? r.type}</span>
                  {r.category && <span>{r.category}</span>}
                </div>
              </div>
              <span className="text-xs text-neutral-400 group-hover:text-brand-blue shrink-0 self-center">↗</span>
            </a>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-400 text-center">{filtered.length} of {resources.length} resources</p>
    </div>
  );
}
