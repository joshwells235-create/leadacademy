"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  MEMORY_CONFIDENCES,
  MEMORY_TYPE_LABELS,
  MEMORY_TYPES,
  type MemoryConfidence,
  type MemoryFact,
  type MemoryType,
} from "@/lib/ai/memory/types";
import { addMemoryFact, deleteMemoryFact, updateMemoryFact } from "@/lib/memory/actions";

const CONFIDENCE_LABEL: Record<MemoryConfidence, string> = {
  low: "Low confidence — mentioned once or unclear",
  medium: "Medium confidence — mentioned a few times",
  high: "High confidence — consistent across conversations",
};

type Props = {
  initialFacts: MemoryFact[];
};

export function MemoryList({ initialFacts }: Props) {
  const [adding, setAdding] = useState(false);
  const groups = groupByType(initialFacts);

  return (
    <div className="space-y-6">
      <div>
        {adding ? (
          <AddFactForm onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-brand-blue bg-white px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
          >
            + Tell your thought partner something to remember
          </button>
        )}
      </div>

      {initialFacts.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="font-serif text-base leading-[1.65] text-brand-navy/75">
            Nothing remembered yet. As you talk, the durable things — patterns, commitments, the
            way you actually like to be coached — will land here. You can always edit or remove
            anything you don't want carried forward.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {MEMORY_TYPES.map((type) => {
            const items = groups.get(type);
            if (!items || items.length === 0) return null;
            return (
              <section key={type}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {MEMORY_TYPE_LABELS[type]}
                </h2>
                <ul className="space-y-2">
                  {items.map((f) => (
                    <FactRow key={f.id} fact={f} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FactRow({ fact }: { fact: MemoryFact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <EditFactForm
        fact={fact}
        onCancel={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  const handleDelete = () => {
    start(async () => {
      const res = await deleteMemoryFact(fact.id);
      if ("error" in res && res.error) {
        setDeleteError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="group rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <ConfidenceDot confidence={fact.confidence} editedByUser={fact.editedByUser} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-brand-navy">{fact.content}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
            {fact.editedByUser ? (
              <span>You added this.</span>
            ) : (
              <>
                <span
                  className="inline-flex items-center gap-1"
                  title={CONFIDENCE_LABEL[fact.confidence]}
                >
                  <span aria-hidden>·</span>
                  {confidenceLabelShort(fact.confidence)} confidence
                </span>
                <span aria-hidden>·</span>
                <span>Last seen {formatRelativeDate(fact.lastSeen)}</span>
                {fact.sourceConversationId && (
                  <>
                    <span aria-hidden>·</span>
                    <Link
                      href={`/coach-chat?c=${fact.sourceConversationId}`}
                      className="text-brand-blue hover:underline"
                    >
                      View source →
                    </Link>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-brand-light"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={pending}
            className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-light/60"
          >
            Delete
          </button>
        </div>
      </div>
      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-label="Delete memory"
          className="mt-3 rounded-md border border-danger/30 bg-danger-light/60 p-2 text-xs"
        >
          <p className="text-brand-navy">
            Delete this memory? Your thought partner won't see it on future turns.
          </p>
          {deleteError && <p className="mt-1 text-red-700">{deleteError}</p>}
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded bg-danger px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
              disabled={pending}
              className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-700 hover:bg-brand-light disabled:opacity-50"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function confidenceLabelShort(c: MemoryConfidence): string {
  return c[0].toUpperCase() + c.slice(1);
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const DAY = 1000 * 60 * 60 * 24;
  if (diff < DAY) return "today";
  if (diff < 2 * DAY) return "yesterday";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function EditFactForm({
  fact,
  onCancel,
  onDone,
}: {
  fact: MemoryFact;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<MemoryType>(fact.type);
  const [content, setContent] = useState(fact.content);
  const [confidence, setConfidence] = useState<MemoryConfidence>(fact.confidence);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateMemoryFact({ id: fact.id, type, content, confidence });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  return (
    <li className="rounded-lg border border-brand-blue bg-white p-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none"
        />
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-neutral-600">Type:</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
              className="rounded border border-neutral-300 px-1 py-0.5"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEMORY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-neutral-600" title="How sure the thought partner is about this.">
              Confidence:
            </span>
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as MemoryConfidence)}
              className="rounded border border-neutral-300 px-1 py-0.5"
            >
              {MEMORY_CONFIDENCES.map((c) => (
                <option key={c} value={c}>
                  {confidenceLabelShort(c)} — {CONFIDENCE_LABEL[c].split(" — ")[1]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-brand-light"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function AddFactForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<MemoryType>("preference");
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length === 0) return;
    start(async () => {
      const res = await addMemoryFact({ type, content, confidence: "high" });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border border-brand-blue bg-white p-4"
    >
      <p className="text-xs text-neutral-600">
        Tell your thought partner something durable to remember — a preference, pattern, or piece of
        context that should carry across conversations.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="I work best when I have 20 minutes to write before a hard conversation."
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none"
      />
      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          <span className="text-neutral-600">Type:</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MemoryType)}
            className="rounded border border-neutral-300 px-1 py-0.5"
          >
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || content.trim().length === 0}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-brand-light"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConfidenceDot({
  confidence,
  editedByUser,
}: {
  confidence: MemoryConfidence;
  editedByUser: boolean;
}) {
  const cls = editedByUser
    ? "bg-brand-blue"
    : confidence === "high"
      ? "bg-emerald-500"
      : confidence === "medium"
        ? "bg-amber-400"
        : "bg-neutral-300";
  const label = editedByUser ? "Added by you" : CONFIDENCE_LABEL[confidence];
  return (
    <span
      className={`block h-2 w-2 rounded-full ${cls}`}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

function groupByType(facts: MemoryFact[]): Map<MemoryType, MemoryFact[]> {
  const m = new Map<MemoryType, MemoryFact[]>();
  for (const f of facts) {
    const list = m.get(f.type) ?? [];
    list.push(f);
    m.set(f.type, list);
  }
  return m;
}
