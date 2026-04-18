"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignCoach } from "@/lib/admin/actions";

export function AssignCoachForm({ learnerId, coaches }: { learnerId: string; coaches: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (coaches.length === 0) return <span className="text-xs text-neutral-400">No coaches</span>;

  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const coachId = e.target.value;
        if (!coachId) return;
        start(async () => {
          await assignCoach(learnerId, coachId);
          router.refresh();
        });
      }}
      disabled={pending}
      className="rounded-md border border-neutral-300 px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
    >
      <option value="">Assign coach...</option>
      {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
