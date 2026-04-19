"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createResource } from "@/lib/community/actions";

export function AddResourceForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("article");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
      >
        + Add resource
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    start(async () => {
      await createResource({
        title,
        url,
        description: description || undefined,
        type,
        category: category || undefined,
      });
      setTitle("");
      setUrl("");
      setDescription("");
      setType("article");
      setCategory("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm space-y-3"
    >
      <h3 className="text-sm font-semibold text-brand-navy">Add a resource</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (https://...)"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Brief description (optional)"
        rows={2}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      <div className="flex gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="article">Article</option>
          <option value="video">Video</option>
          <option value="pdf">PDF</option>
          <option value="tool">Tool</option>
        </select>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g., Feedback, Delegation)"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          Add resource
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
