"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrg } from "@/lib/super/actions";

export function OrgCreateForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">+ New org</button>;

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
      <input value={name} onChange={(e) => { setName(e.target.value); if (!slug || slug === autoSlug(name)) setSlug(autoSlug(e.target.value)); }} placeholder="Organization name" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" autoFocus />
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (URL-safe)" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" />
      {error && <p className="text-xs text-brand-pink">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => start(async () => { const res = await createOrg(name, slug); if ("error" in res) { setError(res.error); return; } router.push(`/super/orgs/${res.id}`); })} disabled={pending || !name.trim() || !slug.trim()} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60">Create</button>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500">Cancel</button>
      </div>
    </div>
  );
}
