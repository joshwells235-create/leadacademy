"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOrg } from "@/lib/super/actions";

type Org = { id: string; name: string; slug: string; logo_url: string | null; status: string };

export function OrgSettings({ org }: { org: Org }) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [status, setStatus] = useState(org.status);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const save = () =>
    start(async () => {
      await updateOrg(org.id, { name, slug, status });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    });

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy">Settings</h2>
        {saved && <span className="text-xs text-emerald-600">✓ Saved</span>}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        placeholder="Org name"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        placeholder="slug"
      />
      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}
