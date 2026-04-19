"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const USAGE_RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "mtd", label: "Month to date" },
  { value: "all", label: "All time" },
] as const;

export function UsageFilterBar({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <select
        value={params.get("range") ?? "30d"}
        onChange={(e) => update("range", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        aria-label="Date range"
      >
        {USAGE_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <select
        value={params.get("org") ?? "all"}
        onChange={(e) => update("org", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue max-w-[200px]"
        aria-label="Filter by organization"
      >
        <option value="all">All orgs</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
