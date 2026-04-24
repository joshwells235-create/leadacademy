"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { labelForRole, MEMBER_ROLES } from "@/lib/admin/roles";
import { superInviteMember, superManuallyAddMember } from "@/lib/super/user-actions";

type Cohort = { id: string; name: string };
type Mode = "closed" | "invite" | "manual";

export function SuperInvitePanel({ orgId, cohorts }: { orgId: string; cohorts: Cohort[] }) {
  const [mode, setMode] = useState<Mode>("closed");

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Add member</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Invite someone or directly create a confirmed user in this org.
          </p>
        </div>
        {mode !== "closed" && (
          <button
            type="button"
            onClick={() => setMode("closed")}
            className="text-[11px] text-neutral-500 hover:text-brand-navy"
          >
            Close
          </button>
        )}
      </div>

      {mode === "closed" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("invite")}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark"
          >
            + Invite member
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-brand-light"
            title="Create a confirmed user directly with a temp password"
          >
            Manually add user…
          </button>
        </div>
      )}

      {mode === "invite" && <InviteTab orgId={orgId} cohorts={cohorts} />}
      {mode === "manual" && <ManualTab orgId={orgId} cohorts={cohorts} />}
    </div>
  );
}

function InviteTab({ orgId, cohorts }: { orgId: string; cohorts: Cohort[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("learner");
  const [cohortId, setCohortId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    start(async () => {
      const res = await superInviteMember(orgId, {
        email,
        role,
        cohortId: cohortId || null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setInviteUrl(res.inviteUrl);
      setEmail("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="super-inv-email" className="text-xs font-medium text-neutral-600">
            Email
          </label>
          <input
            id="super-inv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="super-inv-role" className="text-xs font-medium text-neutral-600">
            Role
          </label>
          <select
            id="super-inv-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {labelForRole(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="super-inv-cohort" className="text-xs font-medium text-neutral-600">
            Cohort (optional)
          </label>
          <select
            id="super-inv-cohort"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">No cohort</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {inviteUrl && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">Invitation sent</p>
          <p className="mt-1 text-xs text-emerald-800">
            Share this link with them. With SMTP configured, it also went out by email.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={inviteUrl}
              readOnly
              aria-label="Invite URL"
              className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function ManualTab({ orgId, cohorts }: { orgId: string; cohorts: Cohort[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("learner");
  const [cohortId, setCohortId] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    { ok: true; email: string; tempPassword: string } | { error: string } | null
  >(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const res = await superManuallyAddMember(orgId, {
        email,
        displayName,
        role,
        cohortId: cohortId || null,
      });
      setResult(res);
      if ("ok" in res) {
        setEmail("");
        setDisplayName("");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-md bg-brand-light/70 p-3 text-xs text-neutral-700">
        Creates a confirmed user with a temp password — skips the email round-trip. Share the
        credentials and tell them to change the password after signing in.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="super-manual-email" className="text-xs font-medium text-neutral-600">
            Email
          </label>
          <input
            id="super-manual-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="super-manual-name" className="text-xs font-medium text-neutral-600">
            Display name
          </label>
          <input
            id="super-manual-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How they'd like to be addressed"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="super-manual-role" className="text-xs font-medium text-neutral-600">
            Role
          </label>
          <select
            id="super-manual-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {labelForRole(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="super-manual-cohort" className="text-xs font-medium text-neutral-600">
            Cohort (optional)
          </label>
          <select
            id="super-manual-cohort"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">No cohort</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create user"}
      </button>

      {result && "error" in result && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {result.error}
        </div>
      )}
      {result && "ok" in result && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">User created</p>
          <div className="mt-3 space-y-1 font-mono text-xs text-neutral-900">
            <div className="flex gap-2">
              <span className="w-16 text-neutral-500">Email:</span>
              <span>{result.email}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-16 text-neutral-500">Password:</span>
              <span className="font-bold">{result.tempPassword}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(result.tempPassword)}
                className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
