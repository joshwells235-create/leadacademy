"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkInvite, inviteMember, manuallyAddMember } from "@/lib/admin/actions";
import { labelForRole, MEMBER_ROLES } from "@/lib/admin/roles";

type Cohort = { id: string; name: string };
type Mode = "closed" | "single" | "bulk" | "manual";

export function InviteForm({ cohorts }: { cohorts: Cohort[] }) {
  const [mode, setMode] = useState<Mode>("closed");

  if (mode === "closed") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("single")}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          + Invite member
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className="rounded-md border border-brand-blue/30 bg-white px-4 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
        >
          Bulk invite…
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-brand-light"
          title="Create a confirmed user directly with a temp password — skips the email confirmation round-trip"
        >
          Manually add user…
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-navy">
          {mode === "single" && "Invite a member"}
          {mode === "bulk" && "Bulk invite — paste one email per line"}
          {mode === "manual" && "Manually add a user (skip email flow)"}
        </h3>
        <div className="flex gap-1 text-[11px]">
          <ModeTab active={mode === "single"} onClick={() => setMode("single")} label="Single" />
          <ModeTab active={mode === "bulk"} onClick={() => setMode("bulk")} label="Bulk" />
          <ModeTab
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            label="Manual add"
          />
          <button
            type="button"
            onClick={() => setMode("closed")}
            className="ml-2 text-neutral-500 hover:text-brand-navy"
          >
            Cancel
          </button>
        </div>
      </div>

      {mode === "single" && <SingleInvite cohorts={cohorts} />}
      {mode === "bulk" && <BulkInvite cohorts={cohorts} />}
      {mode === "manual" && <ManualAdd cohorts={cohorts} />}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-medium transition ${
        active ? "bg-brand-blue text-white" : "text-neutral-600 hover:bg-brand-light"
      }`}
    >
      {label}
    </button>
  );
}

function SingleInvite({ cohorts }: { cohorts: Cohort[] }) {
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
      const res = await inviteMember({ email, role, cohortId: cohortId || null });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setInviteUrl(res.inviteUrl);
      setEmail("");
      // Keep role + cohort sticky for quick follow-up invites
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="inv-email" className="text-xs font-medium text-neutral-600">
            Email
          </label>
          <input
            id="inv-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="learner@example.com"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="inv-role" className="text-xs font-medium text-neutral-600">
            Role
          </label>
          <select
            id="inv-role"
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
          <label htmlFor="inv-cohort" className="text-xs font-medium text-neutral-600">
            Cohort (optional)
          </label>
          <select
            id="inv-cohort"
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
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
        <p className="text-[11px] text-neutral-500">
          Role + cohort stay selected so you can send several in a row.
        </p>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {inviteUrl && <InviteResult url={inviteUrl} />}
    </form>
  );
}

function BulkInvite({ cohorts }: { cohorts: Cohort[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [role, setRole] = useState("learner");
  const [cohortId, setCohortId] = useState("");
  const [pending, start] = useTransition();
  const [results, setResults] = useState<
    Array<
      { email: string; ok: true; inviteUrl: string } | { email: string; ok: false; error: string }
    >
  >([]);

  const parseEmails = (raw: string): string[] => {
    return raw
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emails = parseEmails(text);
    if (emails.length === 0) return;
    setResults([]);
    start(async () => {
      const rows = emails.map((email) => ({
        email,
        role,
        cohortId: cohortId || null,
      }));
      const res = await bulkInvite(rows);
      setResults(res.results);
      router.refresh();
    });
  };

  const emails = parseEmails(text);
  const okCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - okCount;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="bulk-emails" className="text-xs font-medium text-neutral-600">
          Emails ({emails.length} detected)
        </label>
        <textarea
          id="bulk-emails"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="One email per line. Separators can also be commas or spaces."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="bulk-role" className="text-xs font-medium text-neutral-600">
            Role (applies to all)
          </label>
          <select
            id="bulk-role"
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
          <label htmlFor="bulk-cohort" className="text-xs font-medium text-neutral-600">
            Cohort (applies to all)
          </label>
          <select
            id="bulk-cohort"
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
        disabled={pending || emails.length === 0}
        className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
      >
        {pending ? "Sending…" : `Send ${emails.length} invite${emails.length === 1 ? "" : "s"}`}
      </button>

      {results.length > 0 && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3">
          <p className="text-sm font-medium">
            <span className="text-emerald-700">{okCount} sent</span>
            {failedCount > 0 && (
              <>
                {" · "}
                <span className="text-red-700">{failedCount} failed</span>
              </>
            )}
          </p>
          <ul className="mt-2 max-h-64 overflow-y-auto text-xs">
            {results.map((r) => (
              <li
                key={r.email}
                className={`flex items-center justify-between gap-3 border-b border-neutral-50 py-1 last:border-b-0 ${r.ok ? "" : "text-red-700"}`}
              >
                <span className="truncate font-mono">{r.email}</span>
                <span className="shrink-0 text-[11px]">
                  {r.ok ? (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(r.inviteUrl)}
                      className="text-brand-blue hover:underline"
                    >
                      Copy link
                    </button>
                  ) : (
                    r.error
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

function ManualAdd({ cohorts }: { cohorts: Cohort[] }) {
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
      const res = await manuallyAddMember({
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
        <p className="font-semibold text-brand-navy">When to use this</p>
        <p className="mt-1">
          Creates a confirmed user directly with a temp password — skips the email confirmation
          round-trip entirely. Useful when email delivery is flaky, when onboarding someone from the
          LeadShift side who already knows they should be here, or for demo / test accounts. Share
          the temp password and tell them to change it from their profile page after signing in.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="manual-email" className="text-xs font-medium text-neutral-600">
            Email
          </label>
          <input
            id="manual-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="manual-name" className="text-xs font-medium text-neutral-600">
            Display name
          </label>
          <input
            id="manual-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How they'd like to be addressed"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="manual-role" className="text-xs font-medium text-neutral-600">
            Role
          </label>
          <select
            id="manual-role"
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
          <label htmlFor="manual-cohort" className="text-xs font-medium text-neutral-600">
            Cohort (optional)
          </label>
          <select
            id="manual-cohort"
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
          <p className="mt-1 text-xs text-emerald-800">
            Share these credentials with them. Tell them to change the password from their profile
            page after signing in.
          </p>
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

function InviteResult({ url }: { url: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-semibold text-emerald-900">Invitation sent</p>
      <p className="mt-1 text-xs text-emerald-800">
        Share this link with them. With SMTP configured, it also went out by email.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={url}
          readOnly
          aria-label="Invite URL"
          className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 font-mono text-[11px]"
        />
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
