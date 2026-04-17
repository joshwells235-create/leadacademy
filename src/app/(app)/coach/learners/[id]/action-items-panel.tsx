"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createActionItem, toggleActionItem } from "@/lib/coach/actions";

type Item = { id: string; title: string; description: string | null; due_date: string | null; completed: boolean; completed_at: string | null };

export function ActionItemsPanel({ learnerId, items }: { learnerId: string; items: Item[] }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    start(async () => {
      await createActionItem(learnerId, title, undefined, dueDate || undefined);
      setTitle("");
      setDueDate("");
      setShowForm(false);
      router.refresh();
    });
  };

  const handleToggle = (itemId: string) => {
    start(async () => {
      await toggleActionItem(itemId);
      router.refresh();
    });
  };

  return (
    <div>
      {items.length === 0 && !showForm && (
        <p className="text-sm text-neutral-500 mb-2">No action items yet.</p>
      )}

      <ul className="space-y-1.5 mb-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggle(item.id)}
              disabled={pending}
              className="mt-0.5 rounded border-neutral-300"
            />
            <div className={item.completed ? "line-through text-neutral-400" : ""}>
              <span>{item.title}</span>
              {item.due_date && <span className="text-xs text-neutral-500 ml-1">due {item.due_date}</span>}
            </div>
          </li>
        ))}
      </ul>

      {showForm ? (
        <form onSubmit={handleAdd} className="flex gap-2 items-end">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Action item title..."
            className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
          <button type="submit" disabled={pending} className="rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark disabled:opacity-60">Add</button>
          <button type="button" onClick={() => setShowForm(false)} className="text-xs text-neutral-500 hover:text-neutral-700">Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="text-sm text-neutral-700 underline hover:text-neutral-900">
          + Add action item
        </button>
      )}
    </div>
  );
}
