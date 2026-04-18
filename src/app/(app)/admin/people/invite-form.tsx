"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/lib/admin/actions";

export function InviteForm({ cohorts }: { cohorts: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("learner");
  const [cohortId, setCohortId] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ inviteUrl?: string; error?: string } | null>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
        + Invite member
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await inviteMember({ email, role, cohortId: cohortId || undefined });
      if ("error" in res) { setResult({ error: res.error }); return; }
      setResult({ inviteUrl: res.inviteUrl });
      setEmail("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-brand-navy mb-3">Invite a new member</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email address" className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="learner">Learner</option>
            <option value="coach">Coach</option>
            <option value="org_admin">Org Admin</option>
          </select>
          <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">No cohort</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60">
            {pending ? "Sending..." : "Send invite"}
          </button>
          <button type="button" onClick={() => { setOpen(false); setResult(null); }} className="text-sm text-neutral-500">Cancel</button>
        </div>
      </form>

      {result?.error && <p className="mt-3 text-sm text-brand-pink">{result.error}</p>}
      {result?.inviteUrl && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-800 font-medium">Invitation sent!</p>
          <p className="mt-1 text-xs text-emerald-700">Share this link with them:</p>
          <div className="mt-1 flex gap-2">
            <input value={result.inviteUrl} readOnly className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-mono" />
            <button onClick={() => navigator.clipboard.writeText(result.inviteUrl!)} className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}
