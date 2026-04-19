"use client";

import { useTransition } from "react";
import { deleteReflection } from "@/lib/reflections/actions";

export function DeleteReflectionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Delete this reflection?")) return;
        start(async () => {
          await deleteReflection(id);
        });
      }}
      disabled={pending}
      className="text-xs text-neutral-400 hover:text-brand-pink transition disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
