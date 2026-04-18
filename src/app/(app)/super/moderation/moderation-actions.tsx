"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, deleteComment } from "@/lib/super/actions";

export function ModerationActions({ type, id }: { type: "post" | "comment"; id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (!confirm(`Delete this ${type}? This cannot be undone.`)) return;
    start(async () => {
      if (type === "post") await deletePost(id);
      else await deleteComment(id);
      router.refresh();
    });
  };

  return (
    <button onClick={handleDelete} disabled={pending} className="shrink-0 text-xs text-neutral-400 hover:text-brand-pink transition disabled:opacity-50">
      {pending ? "..." : "Delete"}
    </button>
  );
}
