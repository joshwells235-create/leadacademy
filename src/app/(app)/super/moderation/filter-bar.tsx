"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export const DATE_PRESETS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

export function ModerationFilterBar({
  orgs,
  query,
}: {
  orgs: { id: string; name: string }[];
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(query);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const submitQuery = (e: React.FormEvent) => {
    e.preventDefault();
    update("q", q.trim());
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form onSubmit={submitQuery} className="flex-1 min-w-[200px]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search post / comment content (press Enter)"
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </form>
      <select
        value={params.get("type") ?? "both"}
        onChange={(e) => update("type", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        aria-label="Type"
      >
        <option value="both">Posts + comments</option>
        <option value="posts">Posts only</option>
        <option value="comments">Comments only</option>
      </select>
      <select
        value={params.get("org") ?? "all"}
        onChange={(e) => update("org", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue max-w-[180px]"
        aria-label="Filter by organization"
      >
        <option value="all">All orgs</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <select
        value={params.get("range") ?? "30d"}
        onChange={(e) => update("range", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        aria-label="Date range"
      >
        {DATE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
