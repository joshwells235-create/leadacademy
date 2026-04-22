"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AttachmentKind,
  AttachmentSummary,
} from "@/lib/ai/attachments/types";
import {
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_BYTES,
} from "@/lib/ai/attachments/types";

// Composer attachment picker. Renders as a paperclip button next to
// the textarea. Clicking opens the file picker; each selected file is
// uploaded to /api/ai/chat/upload in parallel. Upload progress chips
// render above the composer while in flight; successful uploads turn
// into solid chips with a remove button.
//
// Parent wires:
//   • `attachments` — current committed list (for composer send)
//   • `onAttachmentsChange` — receives updated list on upload / remove
//   • `conversationId` — optional; forwarded to upload so the server
//     can stamp conversation_id on the row up front (backfilled later
//     if absent, e.g. on a brand-new conversation)
//   • `disabled` — composer-wide disable flag (e.g. streaming)
//
// One-time privacy notice: on first upload ever (keyed to
// `la-attachments-notice-seen` in localStorage), a short confidentiality
// reminder renders above the chip row and auto-dismisses after the
// first acknowledgement. Matches the "heads up — transcripts often
// include the other person's words" design commitment.
const PRIVACY_KEY = "la-attachments-notice-seen";

type PendingUpload = {
  localId: string;
  filename: string;
  sizeBytes: number;
  status: "uploading" | "error";
  error?: string;
};

export function AttachmentPicker({
  attachments,
  onAttachmentsChange,
  conversationId,
  disabled,
}: {
  attachments: AttachmentSummary[];
  onAttachmentsChange: (next: AttachmentSummary[]) => void;
  conversationId?: string;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Show the privacy notice once per learner, the first time they
  // attach something. Storage guard means returning learners don't see
  // it again.
  useEffect(() => {
    if (attachments.length === 0 && pending.length === 0) return;
    try {
      if (localStorage.getItem(PRIVACY_KEY) !== "1") {
        setShowPrivacy(true);
      }
    } catch {
      // ignore: localStorage can throw in private-mode Safari; no-op.
    }
  }, [attachments.length, pending.length]);

  const dismissPrivacy = () => {
    setShowPrivacy(false);
    try {
      localStorage.setItem(PRIVACY_KEY, "1");
    } catch {
      // ignore
    }
  };

  const slotsAvailable = Math.max(
    0,
    MAX_FILES_PER_MESSAGE - attachments.length - pending.length,
  );

  const handleFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, slotsAvailable);

    // Add pending rows up front so the UI shows progress chips
    // immediately on pick.
    const pendingRows = selected.map(
      (f): PendingUpload => ({
        localId: crypto.randomUUID(),
        filename: f.name,
        sizeBytes: f.size,
        status: "uploading",
      }),
    );
    setPending((prev) => [...prev, ...pendingRows]);

    // Upload in parallel. Each file's result is committed as soon as it
    // lands so the learner sees chips turn solid individually.
    await Promise.all(
      selected.map(async (file, idx) => {
        const local = pendingRows[idx];
        if (file.size > MAX_FILE_BYTES) {
          setPending((prev) =>
            prev.map((p) =>
              p.localId === local.localId
                ? {
                    ...p,
                    status: "error",
                    error: `Too large (${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB max)`,
                  }
                : p,
            ),
          );
          return;
        }
        const form = new FormData();
        form.append("file", file);
        if (conversationId) form.append("conversationId", conversationId);
        try {
          const res = await fetch("/api/ai/chat/upload", {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setPending((prev) =>
              prev.map((p) =>
                p.localId === local.localId
                  ? { ...p, status: "error", error: body.error ?? "Upload failed" }
                  : p,
              ),
            );
            return;
          }
          const summary = (await res.json()) as AttachmentSummary;
          // Clear the pending row for this file and push the successful
          // summary into the parent list.
          setPending((prev) => prev.filter((p) => p.localId !== local.localId));
          onAttachmentsChange([...(attachmentsRef.current ?? []), summary]);
        } catch {
          setPending((prev) =>
            prev.map((p) =>
              p.localId === local.localId
                ? { ...p, status: "error", error: "Network error" }
                : p,
            ),
          );
        }
      }),
    );

    // Reset the input so picking the same file twice still fires
    // onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Keep a mutable ref of the latest attachments array so the async
  // upload handler above closes over the current value even across
  // rapid re-renders.
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };
  const dismissError = (localId: string) => {
    setPending((prev) => prev.filter((p) => p.localId !== localId));
  };

  const hasAnyChips = attachments.length > 0 || pending.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {showPrivacy && hasAnyChips && (
        <div
          className="flex items-start gap-3 rounded-md px-3 py-2 text-[12px] leading-[1.5]"
          style={{
            border: "1px solid var(--t-rule)",
            background: "var(--t-accent-soft)",
            color: "var(--t-ink)",
          }}
          role="note"
        >
          <span className="flex-1">
            Heads up — transcripts and documents often include other people's
            words. Your thought partner treats this in confidence, but use your
            own judgment about what's yours to share.
          </span>
          <button
            type="button"
            onClick={dismissPrivacy}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft transition hover:text-ink"
            aria-label="Got it, dismiss"
          >
            Got it
          </button>
        </div>
      )}

      {hasAnyChips && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <Chip
              key={a.id}
              filename={a.filename}
              sizeBytes={a.sizeBytes}
              kind={a.kind}
              onRemove={() => removeAttachment(a.id)}
            />
          ))}
          {pending.map((p) => (
            <Chip
              key={p.localId}
              filename={p.filename}
              sizeBytes={p.sizeBytes}
              status={p.status}
              error={p.error}
              onRemove={() => dismissError(p.localId)}
            />
          ))}
        </div>
      )}

      {/* Paperclip trigger + hidden file input. Rendered inline so the
          picker is self-contained — the composer just mounts it above
          the textarea and the button + chips + input + privacy notice
          all live together. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || slotsAvailable === 0}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: "var(--t-rule)" }}
          aria-label="Attach a file"
          title={
            slotsAvailable === 0
              ? `Up to ${MAX_FILES_PER_MESSAGE} files per message`
              : "Attach a file"
          }
        >
          ＋ Attach
        </button>
        {hasAnyChips ? null : (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            Images · PDFs · Transcripts (.txt / .vtt / .srt)
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.vtt,.srt,image/*,application/pdf,text/*"
        onChange={(e) => handleFilesPicked(e.target.files)}
        className="hidden"
        disabled={disabled || slotsAvailable === 0}
      />
    </div>
  );
}

// A tiny chip representing one attached (or uploading / errored) file.
// Tone-matched to the editorial system: paper surface, small rule,
// mono caption for the size, accent pill for the remove button.
function Chip({
  filename,
  sizeBytes,
  kind,
  status,
  error,
  onRemove,
}: {
  filename: string;
  sizeBytes: number;
  kind?: AttachmentKind;
  status?: "uploading" | "error";
  error?: string;
  onRemove: () => void;
}) {
  const label =
    status === "uploading"
      ? "Uploading…"
      : status === "error"
        ? error ?? "Failed"
        : `${humanSize(sizeBytes)} · ${kindLabel(kind)}`;
  const tone =
    status === "error" ? "error" : status === "uploading" ? "pending" : "ready";
  return (
    <div
      className="inline-flex max-w-[260px] items-center gap-2 rounded-full px-3 py-1.5 text-[12px]"
      style={{
        border: "1px solid var(--t-rule)",
        background: tone === "error" ? "var(--t-accent-soft)" : "var(--t-paper)",
        color: tone === "error" ? "var(--t-accent)" : "var(--t-ink)",
      }}
    >
      <span aria-hidden className="text-ink-faint">
        {kind === "image" ? "◱" : kind === "pdf" ? "▤" : "≡"}
      </span>
      <span className="min-w-0 flex-1 truncate">{filename}</span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-ink-soft transition hover:text-accent"
        aria-label={`Remove ${filename}`}
      >
        ×
      </button>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function kindLabel(kind: AttachmentKind | undefined): string {
  if (kind === "image") return "Image";
  if (kind === "pdf") return "PDF";
  if (kind === "text") return "Text";
  return "File";
}

