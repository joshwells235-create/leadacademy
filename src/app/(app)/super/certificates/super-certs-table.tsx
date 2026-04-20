"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { restoreCertificate, revokeCertificate } from "@/lib/certificates/admin-actions";

export type SuperCertRow = {
  id: string;
  learnerName: string;
  subject: string;
  kind: "course" | "path";
  cohortName: string | null;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SuperCertsTable({ rows }: { rows: SuperCertRow[] }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [errById, setErrById] = useState<Record<string, string>>({});
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-neutral-500">No certificates match the current filter.</p>
      </div>
    );
  }

  const onRevoke = (id: string) => {
    start(async () => {
      const res = await revokeCertificate(id);
      if ("error" in res) {
        setErrById((prev) => ({ ...prev, [id]: res.error }));
        return;
      }
      setConfirming(null);
      router.refresh();
    });
  };
  const onRestore = (id: string) => {
    start(async () => {
      const res = await restoreCertificate(id);
      if ("error" in res) {
        setErrById((prev) => ({ ...prev, [id]: res.error }));
        return;
      }
      router.refresh();
    });
  };

  const now = Date.now();

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2 text-left font-medium">Learner</th>
            <th className="px-3 py-2 text-left font-medium">Awarded for</th>
            <th className="px-3 py-2 text-left font-medium">Cohort</th>
            <th className="px-3 py-2 text-left font-medium">Issued</th>
            <th className="px-3 py-2 text-left font-medium">Expires</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expired = r.expiresAt ? new Date(r.expiresAt).getTime() < now : false;
            const status = r.revokedAt ? "revoked" : expired ? "expired" : "active";
            return (
              <tr key={r.id} className="border-b border-neutral-50 hover:bg-brand-light/30">
                <td className="px-4 py-2.5 font-medium text-brand-navy">{r.learnerName}</td>
                <td className="px-3 py-2.5">
                  <div>{r.subject}</div>
                  <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                    {r.kind === "course" ? "Course" : "Learning path"}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{r.cohortName ?? "—"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{fmt(r.issuedAt)}</td>
                <td className="px-3 py-2.5 text-neutral-600">
                  {r.expiresAt ? fmt(r.expiresAt) : "Non-expiring"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : status === "expired"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand-pink/10 text-brand-pink"
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {confirming === r.id ? (
                    <ConfirmBlock
                      title="Revoke this certificate?"
                      tone="destructive"
                      confirmLabel="Revoke"
                      onConfirm={() => onRevoke(r.id)}
                      onCancel={() => setConfirming(null)}
                      pending={pending}
                      error={errById[r.id]}
                    >
                      Learner still sees the row but it's marked revoked. Action is logged.
                    </ConfirmBlock>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/certificates/${r.id}`}
                        className="text-xs text-brand-blue hover:underline"
                      >
                        View
                      </Link>
                      {r.revokedAt ? (
                        <button
                          type="button"
                          onClick={() => onRestore(r.id)}
                          disabled={pending}
                          className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(r.id)}
                          className="rounded border border-brand-pink/30 bg-white px-2 py-0.5 text-[11px] text-brand-pink hover:bg-brand-pink/5"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
