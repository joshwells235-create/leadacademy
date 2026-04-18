"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeRole, archiveMember } from "@/lib/admin/actions";

export function MemberActions({ membershipId, currentRole, status }: { membershipId: string; currentRole: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (status === "archived") return <span className="text-xs text-neutral-400">Archived</span>;

  const handleRole = (newRole: string) => {
    start(async () => {
      await changeRole(membershipId, newRole);
      setOpen(false);
      router.refresh();
    });
  };

  const handleArchive = () => {
    if (!confirm("Archive this member? They will lose access.")) return;
    start(async () => {
      await archiveMember(membershipId);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={pending} className="text-xs text-neutral-500 hover:text-brand-blue">
        •••
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            {currentRole !== "learner" && <button onClick={() => handleRole("learner")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-light">Set as Learner</button>}
            {currentRole !== "coach" && <button onClick={() => handleRole("coach")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-light">Set as Coach</button>}
            {currentRole !== "org_admin" && <button onClick={() => handleRole("org_admin")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-light">Set as Admin</button>}
            <div className="my-1 border-t border-neutral-100" />
            <button onClick={handleArchive} className="w-full text-left px-3 py-1.5 text-xs text-brand-pink hover:bg-brand-pink-light">Archive</button>
          </div>
        </>
      )}
    </div>
  );
}
