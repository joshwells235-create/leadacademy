"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { deleteComment, deletePost } from "@/lib/super/actions";

export function ModerationActions({ type, id }: { type: "post" | "comment"; id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (confirming) {
    return (
      <div className="shrink-0 w-64">
        <ConfirmBlock
          title={`Delete this ${type}?`}
          tone="destructive"
          confirmLabel={`Delete ${type}`}
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            start(async () => {
              if (type === "post") await deletePost(id);
              else await deleteComment(id);
              setConfirming(false);
              router.refresh();
            })
          }
        >
          This removes the {type} for all learners who can see it. Cannot be undone.
        </ConfirmBlock>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={pending}
      className="shrink-0 text-xs text-neutral-400 hover:text-danger transition disabled:opacity-50"
    >
      Delete
    </button>
  );
}
