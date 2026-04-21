"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPath } from "@/lib/learning/path-actions";

type Org = { id: string; name: string };

export function CreatePathButton({ orgs }: { orgs: Org[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
      >
        + New path
      </button>
    );
  }

  const submit = () => {
    setErr(null);
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    start(async () => {
      const res = await createPath({
        name: name.trim(),
        org_id: orgId || null,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      router.push(`/super/learning-paths/${res.id}`);
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Path name…"
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      <select
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
      >
        <option value="">All orgs (template)</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
