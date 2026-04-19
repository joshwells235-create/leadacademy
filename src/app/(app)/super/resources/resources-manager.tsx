"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import { createResource, deleteResource, updateResource } from "@/lib/super/resource-actions";

export type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: string;
  category: string | null;
  createdAt: string;
};

const TYPE_OPTIONS = ["article", "video", "book", "podcast", "worksheet", "template", "other"];

export function ResourcesManager({ rows }: { rows: ResourceRow[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return Array.from(set).sort();
  }, [rows]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.type);
    for (const t of TYPE_OPTIONS) set.add(t);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (q) {
        const hay = `${r.title} ${r.description ?? ""} ${r.url}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, typeFilter, categoryFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, description, URL"
          className="flex-1 min-w-[220px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark"
        >
          + New resource
        </button>
      </div>

      {creating && <ResourceForm onClose={() => setCreating(false)} />}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          {rows.length === 0
            ? "No resources yet. Add one to get started."
            : "No resources match those filters."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) =>
            editingId === r.id ? (
              <ResourceForm key={r.id} initial={r} onClose={() => setEditingId(null)} />
            ) : (
              <ResourceCard key={r.id} row={r} onEdit={() => setEditingId(r.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function ResourceCard({ row, onEdit }: { row: ResourceRow; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const runDelete = () => {
    setError(null);
    start(async () => {
      const res = await deleteResource(row.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-brand-navy">{row.title}</h3>
            <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-blue">
              {row.type}
            </span>
            {row.category && (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">
                {row.category}
              </span>
            )}
          </div>
          {row.description && (
            <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{row.description}</p>
          )}
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block truncate text-xs text-brand-blue hover:underline"
          >
            {row.url}
          </a>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <button type="button" onClick={onEdit} className="text-brand-blue hover:underline">
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-brand-pink hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
      {confirming && (
        <div className="mt-3">
          <ConfirmBlock
            title={`Delete "${row.title}"?`}
            tone="destructive"
            confirmLabel="Delete resource"
            pending={pending}
            onCancel={() => setConfirming(false)}
            onConfirm={runDelete}
          >
            Removes the resource from the learner-facing library. Cannot be undone.
          </ConfirmBlock>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  );
}

function ResourceForm({ initial, onClose }: { initial?: ResourceRow; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [type, setType] = useState(initial?.type ?? "article");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const save = () => {
    setError(null);
    start(async () => {
      const payload = {
        title,
        description: description || null,
        url,
        type,
        category: category || null,
      };
      const res = initial
        ? await updateResource(initial.id, payload)
        : await createResource(payload);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-4 mb-3">
      <h3 className="text-sm font-semibold text-brand-navy mb-3">
        {initial ? "Edit resource" : "New resource"}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600 mb-1">URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1">
            Category (optional)
          </span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Giving Feedback"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !title.trim() || !url.trim()}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Create resource"}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-neutral-500">
          Cancel
        </button>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
