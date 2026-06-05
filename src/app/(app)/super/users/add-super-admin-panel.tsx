"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addSuperAdmin } from "@/lib/super/user-actions";

type OrgOption = { id: string; name: string };

/**
 * Onboard a new LeadShift super admin. One flow covers both cases:
 *   - email already has an account → grants super-admin to it
 *   - email is new → creates a confirmed account (temp password) +
 *     grants super-admin
 * Org attachment is optional (super powers don't require a membership).
 */
export function AddSuperAdminPanel({ orgs }: { orgs: OrgOption[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    | { ok: true; created: boolean; email: string; tempPassword?: string }
    | { error: string }
    | null
  >(null);
  const router = useRouter();

  const submit = () => {
    setResult(null);
    start(async () => {
      const res = await addSuperAdmin({
        email,
        displayName,
        orgId: orgId || null,
      });
      setResult(res);
      if ("ok" in res) {
        setEmail("");
        setDisplayName("");
        router.refresh();
      }
    });
  };

  if (!open) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          + Add super admin
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Add a super admin</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            If the email already has an account we just grant super-admin. If it's new, we create a
            confirmed account and hand you a temp password to share.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-[11px] text-neutral-500 hover:text-brand-navy"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="sa-email" className="text-xs font-medium text-neutral-600">
            Email
          </label>
          <input
            id="sa-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@leadshift.com"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="sa-name" className="text-xs font-medium text-neutral-600">
            Display name
          </label>
          <input
            id="sa-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How they'd like to be addressed"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <div>
          <label htmlFor="sa-org" className="text-xs font-medium text-neutral-600">
            Attach to org (optional)
          </label>
          <select
            id="sa-org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">No org — LeadShift staff only</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !email.trim() || !displayName.trim()}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Working…" : "Grant super-admin"}
        </button>
        <p className="text-[11px] text-neutral-500">
          They'll be able to manage every org. Choose carefully.
        </p>
      </div>

      {result && "error" in result && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {result.error}
        </div>
      )}
      {result && "ok" in result && (
        <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            {result.created ? "Account created + super-admin granted" : "Super-admin granted"}
          </p>
          {result.created && result.tempPassword ? (
            <>
              <p className="mt-1 text-xs text-emerald-800">
                Share these credentials out-of-band (text / Slack / phone). Tell them to change the
                password from their profile after signing in.
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
                    onClick={() => navigator.clipboard.writeText(result.tempPassword ?? "")}
                    className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-emerald-800">
              <strong>{result.email}</strong> already had an account — they now have super-admin
              access. They can use their existing password.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
