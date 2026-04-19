"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  moduleCount: number;
  lessonCount: number;
};

export function CoursesList({ rows }: { rows: CourseRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sort, setSort] = useState<"title" | "created" | "lessons">("title");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "lessons") return b.lessonCount - a.lessonCount;
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [rows, query, statusFilter, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses"
          className="flex-1 min-w-[200px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Sort"
        >
          <option value="title">Sort: Title</option>
          <option value="created">Sort: Recently created</option>
          <option value="lessons">Sort: Lesson count</option>
        </select>
        <div className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No courses match those filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/super/course-builder/${c.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-brand-navy">{c.title}</h2>
                    {c.description && (
                      <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                      <span>
                        {c.moduleCount} module{c.moduleCount !== 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>
                        {c.lessonCount} lesson{c.lessonCount !== 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "published" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
