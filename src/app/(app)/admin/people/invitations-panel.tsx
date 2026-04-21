"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resendInvitation, revokeInvitation } from "@/lib/admin/actions";
import { labelForRole } from "@/lib/admin/roles";

export type InviteRow = {
  id: string;
  email: string;
  role: string;
  consumed_at: string | null;
  expires_at: string;
  created_at: string;
};

function statusOf(inv: InviteRow): "accepted" | "expired" | "pending" {
  if (inv.consumed_at) return "accepted";
  if (new Date(inv.expires_at) < new Date()) return "expired";
  return "pending";
}

function daysToExpiry(inv: InviteRow): number {
  const ms = new Date(inv.expires_at).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function InvitationsPanel({ invitations }: { invitations: InviteRow[] }) {
  const pending = invitations.filter((i) => statusOf(i) === "pending");
  const expired = invitations.filter((i) => statusOf(i) === "expired");
  const accepted = invitations.filter((i) => statusOf(i) === "accepted");

  if (invitations.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-navy">Recent invitations</h3>
        <div className="text-[11px] text-neutral-500">
          <span className="font-medium text-amber-700">{pending.length} pending</span> ·{" "}
          <span className="font-medium text-emerald-700">{accepted.length} accepted</span> ·{" "}
          <span className="font-medium text-neutral-500">{expired.length} expired</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2 text-left font-medium">Email</th>
            <th className="px-3 py-2 text-left font-medium">Role</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Sent</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <InvitationRow key={inv.id} inv={inv} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvitationRow({ inv }: { inv: InviteRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = statusOf(inv);
  const daysLeft = daysToExpiry(inv);

  const handleResend = () => {
    setError(null);
    setToast(null);
    start(async () => {
      const res = await resendInvitation(inv.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      await navigator.clipboard.writeText(res.inviteUrl);
      setToast("New link copied to clipboard. Expires in 14 days.");
      setTimeout(() => setToast(null), 5000);
      router.refresh();
    });
  };

  const handleRevoke = () => {
    if (!confirm("Revoke this invitation? The current link will stop working immediately.")) return;
    setError(null);
    setToast(null);
    start(async () => {
      const res = await revokeInvitation(inv.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <tr className="border-b border-neutral-50">
      <td className="px-4 py-2.5 text-brand-navy">{inv.email}</td>
      <td className="px-3 py-2.5 text-neutral-700">{labelForRole(inv.role)}</td>
      <td className="px-3 py-2.5">
        {status === "accepted" ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
            Accepted
          </span>
        ) : status === "expired" ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            Expired
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
            Pending · {daysLeft}d left
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[11px] text-neutral-500">
        {new Date(inv.created_at).toLocaleDateString()}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="inline-flex flex-wrap justify-end gap-1 text-[11px]">
          {status === "pending" && (
            <>
              <button
                type="button"
                onClick={handleResend}
                disabled={pending}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-700 hover:bg-brand-light disabled:opacity-50"
                title="Rotate the token and extend expiration by 14 days. The current link stops working."
              >
                Resend
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={pending}
                className="rounded border border-danger/30 bg-white px-2 py-0.5 text-danger hover:bg-danger-light/60 disabled:opacity-50"
              >
                Revoke
              </button>
            </>
          )}
          {status === "expired" && (
            <button
              type="button"
              onClick={handleResend}
              disabled={pending}
              className="rounded border border-brand-blue/30 bg-white px-2 py-0.5 text-brand-blue hover:bg-brand-blue/5 disabled:opacity-50"
            >
              Re-send
            </button>
          )}
        </div>
        {toast && <p className="mt-1 text-[11px] text-emerald-700">{toast}</p>}
        {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}
      </td>
    </tr>
  );
}
