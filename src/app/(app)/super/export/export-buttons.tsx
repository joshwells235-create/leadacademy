"use client";

import { useState } from "react";

type Org = { id: string; name: string };

const EXPORTS: { key: string; label: string; description: string }[] = [
  { key: "members", label: "Members", description: "All members across orgs with roles and cohorts." },
  { key: "goals", label: "Goals", description: "All goals with SMART criteria, impact statements, and status." },
  { key: "action_logs", label: "Action Logs", description: "All logged actions with reflections and dates." },
  { key: "reflections", label: "Reflections", description: "All reflections with themes." },
  { key: "ai_usage", label: "AI Usage", description: "Daily AI usage rollups per user per model." },
  { key: "lesson_progress", label: "Lesson Progress", description: "Course completion data per learner." },
];

export function ExportButtons({ orgs }: { orgs: Org[] }) {
  const [orgFilter, setOrgFilter] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (key: string) => {
    setDownloading(key);
    try {
      const params = new URLSearchParams({ type: key });
      if (orgFilter) params.set("orgId", orgFilter);
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) { alert("Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}${orgFilter ? `-${orgFilter.slice(0, 8)}` : ""}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-brand-navy mb-1">Filter by organization (optional)</label>
        <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue">
          <option value="">All organizations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {EXPORTS.map((ex) => (
          <div key={ex.key} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-brand-navy">{ex.label}</h3>
            <p className="mt-0.5 text-xs text-neutral-600">{ex.description}</p>
            <button
              onClick={() => handleExport(ex.key)}
              disabled={downloading === ex.key}
              className="mt-3 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              {downloading === ex.key ? "Exporting..." : "Download CSV"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
