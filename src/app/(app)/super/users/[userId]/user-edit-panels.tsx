"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { labelForRole, MEMBER_ROLES, roleBadgeClass } from "@/lib/admin/roles";
import {
  changeMembershipRole,
  confirmUserEmail,
  moveMembershipToOrg,
  restoreUser,
  revokeUserSessions,
  sendPasswordReset,
  setSuperAdmin,
  softDeleteUser,
  updateUserEmail,
  updateUserProfile,
} from "@/lib/super/user-actions";

type OrgOption = { id: string; name: string };
type CohortOption = { id: string; name: string; org_id: string };

type Props = {
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  isSuperAdmin: boolean;
  deletedAt: string | null;
  isSelf: boolean;
  profile: {
    display_name: string | null;
    role_title: string | null;
    function_area: string | null;
    industry: string | null;
    company_size: string | null;
    team_size: number | null;
    total_org_influence: number | null;
    tenure_at_org: string | null;
    tenure_in_leadership: string | null;
    context_notes: string | null;
  };
  memberships: Array<{
    id: string;
    orgId: string;
    orgName: string;
    role: string;
    status: string;
    cohortId: string | null;
    cohortName: string | null;
  }>;
  orgs: OrgOption[];
  cohorts: CohortOption[];
};

export function UserEditPanels(props: Props) {
  return (
    <div className="space-y-6">
      <ProfilePanel userId={props.userId} initial={props.profile} disabled={!!props.deletedAt} />
      <EmailPanel
        userId={props.userId}
        currentEmail={props.email}
        emailConfirmed={props.emailConfirmed}
        disabled={!!props.deletedAt}
      />
      <AuthActionsPanel
        userId={props.userId}
        hasEmail={!!props.email}
        disabled={!!props.deletedAt}
      />
      <SuperAdminPanel
        userId={props.userId}
        isSuperAdmin={props.isSuperAdmin}
        isSelf={props.isSelf}
      />
      <MembershipsPanel
        userId={props.userId}
        memberships={props.memberships}
        orgs={props.orgs}
        cohorts={props.cohorts}
      />
      <DangerPanel
        userId={props.userId}
        deleted={!!props.deletedAt}
        deletedAt={props.deletedAt}
        isSelf={props.isSelf}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function ProfilePanel({
  userId,
  initial,
  disabled,
}: {
  userId: string;
  initial: Props["profile"];
  disabled: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const setField = <K extends keyof Props["profile"]>(key: K, value: Props["profile"][K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    start(async () => {
      const res = await updateUserProfile(userId, values);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <Card title="Profile">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Display name"
          value={values.display_name ?? ""}
          onChange={(v) => setField("display_name", v || null)}
          disabled={disabled}
        />
        <Input
          label="Role title"
          value={values.role_title ?? ""}
          onChange={(v) => setField("role_title", v || null)}
          disabled={disabled}
        />
        <Input
          label="Function area"
          value={values.function_area ?? ""}
          onChange={(v) => setField("function_area", v || null)}
          disabled={disabled}
        />
        <Input
          label="Industry"
          value={values.industry ?? ""}
          onChange={(v) => setField("industry", v || null)}
          disabled={disabled}
        />
        <Input
          label="Company size"
          value={values.company_size ?? ""}
          onChange={(v) => setField("company_size", v || null)}
          disabled={disabled}
        />
        <Input
          label="Team size"
          type="number"
          value={values.team_size?.toString() ?? ""}
          onChange={(v) => setField("team_size", v === "" ? null : Number.parseInt(v, 10))}
          disabled={disabled}
        />
        <Input
          label="Total org influence"
          type="number"
          value={values.total_org_influence?.toString() ?? ""}
          onChange={(v) =>
            setField("total_org_influence", v === "" ? null : Number.parseInt(v, 10))
          }
          disabled={disabled}
        />
        <Input
          label="Tenure at org"
          value={values.tenure_at_org ?? ""}
          onChange={(v) => setField("tenure_at_org", v || null)}
          disabled={disabled}
        />
        <Input
          label="Tenure in leadership"
          value={values.tenure_in_leadership ?? ""}
          onChange={(v) => setField("tenure_in_leadership", v || null)}
          disabled={disabled}
        />
      </div>
      <div className="mt-3">
        <label className="block text-xs font-medium text-neutral-600 mb-1">Context notes</label>
        <textarea
          value={values.context_notes ?? ""}
          onChange={(e) => setField("context_notes", e.target.value || null)}
          disabled={disabled}
          rows={3}
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-neutral-50"
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || disabled}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
        {saved && <span className="text-xs text-emerald-700">✓ Saved</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </Card>
  );
}

function EmailPanel({
  userId,
  currentEmail,
  emailConfirmed,
  disabled,
}: {
  userId: string;
  currentEmail: string | null;
  emailConfirmed: boolean;
  disabled: boolean;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [skipReverify, setSkipReverify] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const change = () => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await updateUserEmail(userId, newEmail, {
        skipReverification: skipReverify,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      setDone(`Email updated to ${newEmail}.`);
      setNewEmail("");
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <Card title="Email">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-brand-navy">{currentEmail ?? "—"}</span>
        {emailConfirmed ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            confirmed
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
            unconfirmed
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          placeholder="new@email.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          disabled={disabled}
          className="flex-1 min-w-[200px] rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-neutral-50"
        />
        <label className="flex items-center gap-1 text-[11px] text-neutral-600">
          <input
            type="checkbox"
            checked={skipReverify}
            onChange={(e) => setSkipReverify(e.target.checked)}
            disabled={disabled}
          />
          Skip re-verification
        </label>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending || disabled || !newEmail.trim()}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          Change email
        </button>
      </div>
      {confirming && (
        <div className="mt-3">
          <ConfirmBlock
            title={`Change email to ${newEmail}?`}
            tone="caution"
            confirmLabel={pending ? "Working…" : "Confirm change"}
            pending={pending}
            onCancel={() => setConfirming(false)}
            onConfirm={change}
          >
            {skipReverify ? (
              <>
                The new address will be marked <strong>confirmed immediately</strong>. Use only when
                you've verified ownership out-of-band.
              </>
            ) : (
              <>
                Supabase will send a confirmation email to the new address. The user must click the
                link before the change takes effect.
              </>
            )}
          </ConfirmBlock>
        </div>
      )}
      {done && <p className="mt-2 text-xs text-emerald-700">{done}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}

function AuthActionsPanel({
  userId,
  hasEmail,
  disabled,
}: {
  userId: string;
  hasEmail: boolean;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

  const reset = () => {
    setError(null);
    setDone(null);
    setResetLink(null);
    start(async () => {
      const res = await sendPasswordReset(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setResetLink(res.link ?? null);
      setDone("Password reset link generated. Supabase also emailed the user.");
    });
  };

  const confirm = () => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await confirmUserEmail(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDone("Email confirmed.");
      router.refresh();
    });
  };

  const revoke = () => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await revokeUserSessions(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDone("All sessions revoked. User will be signed out next request.");
    });
  };

  return (
    <Card title="Auth actions">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={pending || disabled || !hasEmail}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-navy hover:bg-brand-light disabled:opacity-60"
        >
          Send password reset
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || disabled}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-navy hover:bg-brand-light disabled:opacity-60"
        >
          Manually confirm email
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending || disabled}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-navy hover:bg-brand-light disabled:opacity-60"
        >
          Revoke all sessions
        </button>
      </div>
      {resetLink && (
        <div className="mt-3 rounded-md border border-brand-blue/30 bg-brand-blue/5 p-3">
          <p className="text-[11px] font-medium text-brand-blue mb-1">
            Reset link (share with user if email delivery is down):
          </p>
          <p className="break-all font-mono text-[11px] text-brand-navy">{resetLink}</p>
        </div>
      )}
      {done && <p className="mt-2 text-xs text-emerald-700">{done}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}

function SuperAdminPanel({
  userId,
  isSuperAdmin,
  isSelf,
}: {
  userId: string;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const toggle = () => {
    setError(null);
    start(async () => {
      const res = await setSuperAdmin(userId, !isSuperAdmin);
      if ("error" in res && res.error) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <Card title="Super admin">
      <p className="text-sm">
        {isSuperAdmin ? (
          <>
            <strong className="text-brand-navy">Super admin</strong> — full platform access.
          </>
        ) : (
          <>Standard user — no cross-org access.</>
        )}
      </p>
      {confirming ? (
        <div className="mt-3">
          <ConfirmBlock
            title={isSuperAdmin ? "Revoke super-admin access?" : "Grant super-admin access?"}
            tone={isSuperAdmin ? "caution" : "caution"}
            confirmLabel={pending ? "Working…" : isSuperAdmin ? "Revoke" : "Grant"}
            pending={pending}
            onCancel={() => setConfirming(false)}
            onConfirm={toggle}
          >
            {isSuperAdmin
              ? "This user will lose access to every super-admin surface across all orgs."
              : "This user will gain full cross-org access, including every learner's data and destructive operations."}
          </ConfirmBlock>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isSelf && isSuperAdmin}
          className="mt-3 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-navy hover:bg-brand-light disabled:opacity-60"
          title={
            isSelf && isSuperAdmin ? "You can't revoke your own super-admin access." : undefined
          }
        >
          {isSuperAdmin ? "Revoke super-admin" : "Grant super-admin"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}

function MembershipsPanel({
  userId,
  memberships,
  orgs,
  cohorts,
}: {
  userId: string;
  memberships: Props["memberships"];
  orgs: OrgOption[];
  cohorts: CohortOption[];
}) {
  return (
    <Card title={`Memberships (${memberships.length})`}>
      {memberships.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No memberships. Invite this user to an org from the org's People tab, or create a
          membership directly via the data-ops UI.
        </p>
      ) : (
        <ul className="space-y-3">
          {memberships.map((m) => (
            <MembershipRow key={m.id} userId={userId} mem={m} orgs={orgs} cohorts={cohorts} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MembershipRow({
  userId,
  mem,
  orgs,
  cohorts,
}: {
  userId: string;
  mem: Props["memberships"][number];
  orgs: OrgOption[];
  cohorts: CohortOption[];
}) {
  const [pending, start] = useTransition();
  const [editingRole, setEditingRole] = useState(false);
  const [editingMove, setEditingMove] = useState(false);
  const [role, setRole] = useState(mem.role);
  const [orgId, setOrgId] = useState(mem.orgId);
  const [cohortId, setCohortId] = useState<string>(mem.cohortId ?? "");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const saveRole = () => {
    setError(null);
    start(async () => {
      const res = await changeMembershipRole(mem.id, role);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setEditingRole(false);
      router.refresh();
    });
  };

  const saveMove = () => {
    setError(null);
    start(async () => {
      const res = await moveMembershipToOrg(mem.id, orgId, cohortId || null);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setEditingMove(false);
      router.refresh();
    });
  };

  const cohortsInTargetOrg = cohorts.filter((c) => c.org_id === orgId);

  return (
    <li className="rounded-md border border-neutral-100 bg-brand-light/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-navy">{mem.orgName}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className={`rounded-full px-1.5 py-0.5 font-medium ${roleBadgeClass(mem.role)}`}>
              {labelForRole(mem.role)}
            </span>
            {mem.cohortName && <span className="text-neutral-500">· {mem.cohortName}</span>}
            {mem.status !== "active" && <span className="text-neutral-500">· {mem.status}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => {
              setEditingRole(true);
              setEditingMove(false);
            }}
            className="text-brand-blue hover:underline"
          >
            Change role
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingMove(true);
              setEditingRole(false);
            }}
            className="text-brand-blue hover:underline"
          >
            Move to org / cohort
          </button>
        </div>
      </div>

      {editingRole && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {labelForRole(r)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveRole}
            disabled={pending}
            className="rounded-md bg-brand-blue px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingRole(false);
              setRole(mem.role);
            }}
            className="text-[11px] text-neutral-500"
          >
            Cancel
          </button>
        </div>
      )}

      {editingMove && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              setCohortId("");
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
            aria-label="Target org"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
            aria-label="Target cohort"
          >
            <option value="">— no cohort —</option>
            {cohortsInTargetOrg.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveMove}
            disabled={pending}
            className="rounded-md bg-brand-blue px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingMove(false);
              setOrgId(mem.orgId);
              setCohortId(mem.cohortId ?? "");
            }}
            className="text-[11px] text-neutral-500"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {/* userId consumed above in actions */}
      <input type="hidden" value={userId} readOnly />
    </li>
  );
}

function DangerPanel({
  userId,
  deleted,
  deletedAt,
  isSelf,
}: {
  userId: string;
  deleted: boolean;
  deletedAt: string | null;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const runDelete = () => {
    setError(null);
    start(async () => {
      const res = await softDeleteUser(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  const runRestore = () => {
    setError(null);
    start(async () => {
      const res = await restoreUser(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card title="Danger zone" tone="danger">
      {deleted ? (
        <>
          <p className="text-sm">
            Soft-deleted{" "}
            {deletedAt && (
              <span className="text-neutral-500">({new Date(deletedAt).toLocaleString()})</span>
            )}
            . All memberships archived, sessions revoked. Restore to reactivate (memberships stay
            archived — re-add to orgs manually).
          </p>
          <button
            type="button"
            onClick={runRestore}
            disabled={pending}
            className="mt-3 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Restore user
          </button>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </>
      ) : confirming ? (
        <ConfirmBlock
          title="Soft-delete this user?"
          tone="destructive"
          confirmLabel={pending ? "Working…" : "Soft-delete"}
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={runDelete}
        >
          Marks the profile deleted, archives every active membership, and revokes all sessions.
          Auth.users row is kept for audit. You can restore later.
        </ConfirmBlock>
      ) : (
        <>
          <p className="text-sm text-neutral-700">
            Soft-delete deactivates the account across every org. History is preserved; they can be
            restored. For hard delete (GDPR erasure), contact engineering.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isSelf}
            className="mt-3 rounded-md border border-danger/40 bg-white px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-light/60 disabled:opacity-60"
            title={isSelf ? "You can't soft-delete your own account." : undefined}
          >
            Soft-delete user
          </button>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const borderClass = tone === "danger" ? "border-danger/30" : "border-neutral-200";
  return (
    <section className={`rounded-lg border ${borderClass} bg-white p-5 shadow-sm`}>
      <h2
        className={`mb-3 text-sm font-semibold ${tone === "danger" ? "text-danger" : "text-brand-navy"}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-neutral-50"
      />
    </label>
  );
}
