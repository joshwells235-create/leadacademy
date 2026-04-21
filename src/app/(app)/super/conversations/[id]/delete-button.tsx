"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { superDeleteConversation } from "@/lib/super/artifact-actions";

export function DeleteConversationButton({
  conversationId,
  userId,
  orgId,
}: {
  conversationId: string;
  userId: string;
  orgId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const runDelete = () => {
    setError(null);
    start(async () => {
      const res = await superDeleteConversation(conversationId);
      if ("error" in res && res.error) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      router.push(`/super/orgs/${orgId}/members/${userId}`);
    });
  };

  if (confirming) {
    return (
      <div className="mt-2">
        <ConfirmBlock
          title="Delete this conversation?"
          tone="destructive"
          confirmLabel="Delete conversation"
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={runDelete}
        >
          Removes the conversation and all its messages permanently. Cannot be undone. Useful for
          removing AI hallucinations or sensitive content before distillation picks them up.
        </ConfirmBlock>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-danger hover:underline"
    >
      Delete conversation
    </button>
  );
}
