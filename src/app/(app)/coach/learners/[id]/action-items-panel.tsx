"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createActionItem, toggleActionItem } from "@/lib/coach/actions";

type Item = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
};

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function ActionItemsPanel({
  learnerId,
  items,
  today,
}: {
  learnerId: string;
  items: Item[];
  today: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>(defaultDueDate());
  const [pending, start] = useTransition();
  const router = useRouter();

  const { open, overdue, done } = useMemo(() => {
    const o: Item[] = [];
    const v: Item[] = [];
    const d: Item[] = [];
    for (const i of items) {
      if (i.completed) d.push(i);
      else if (i.due_date && i.due_date < today) v.push(i);
      else o.push(i);
    }
    return { open: o, overdue: v, done: d };
  }, [items, today]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    start(async () => {
      await createActionItem(
        learnerId,
        title.trim(),
        description.trim() || undefined,
        dueDate || undefined,
      );
      setTitle("");
      setDescription("");
      setDueDate(defaultDueDate());
      setShowForm(false);
      router.refresh();
    });
  };

  const handleToggle = (item: Item) => {
    // Complete needs no confirmation; uncompleting a completed item (rare)
    // deserves a quick confirm since it effectively re-surfaces the
    // commitment to the learner.
    if (item.completed) {
      if (!confirm("Re-open this action item? The learner will see it as pending again.")) return;
    }
    start(async () => {
      await toggleActionItem(item.id);
      router.refresh();
    });
  };

  return (
    <div>
      {items.length === 0 && !showForm && (
        <p className="mb-3 text-sm text-neutral-500">No action items yet.</p>
      )}

      {overdue.length > 0 && (
        <ItemList
          label="Overdue"
          tone="overdue"
          items={overdue}
          onToggle={handleToggle}
          pending={pending}
          today={today}
        />
      )}
      {open.length > 0 && (
        <ItemList
          label={overdue.length > 0 ? "Open" : undefined}
          tone="open"
          items={open}
          onToggle={handleToggle}
          pending={pending}
          today={today}
        />
      )}
      {done.length > 0 && (
        <ItemList
          label={`Completed (${done.length})`}
          tone="done"
          items={done}
          onToggle={handleToggle}
          pending={pending}
          today={today}
          collapsed
        />
      )}

      <div className="mt-3">
        {showForm ? (
          <form
            onSubmit={handleAdd}
            className="space-y-2 rounded-md border border-brand-blue/40 bg-brand-blue/5 p-3"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should they do?"
              aria-label="Action item title"
              maxLength={300}
              // biome-ignore lint/a11y/noAutofocus: form was just expanded by user action — focus is the expected follow-through
              autoFocus
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional detail — the why, the how, or what to notice while doing it."
              aria-label="Action item description"
              rows={2}
              maxLength={2000}
              className="w-full resize-y rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-neutral-600">
                Due:
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={today}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                />
              </label>
              <button
                type="button"
                onClick={() => setDueDate("")}
                className="text-[11px] text-neutral-500 hover:text-brand-blue"
              >
                Clear date
              </button>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setTitle("");
                    setDescription("");
                  }}
                  className="rounded-md px-2 py-1 text-xs text-neutral-600 hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !title.trim()}
                  className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
                >
                  {pending ? "Adding…" : "Add item"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-brand-blue hover:underline"
          >
            + Add action item
          </button>
        )}
      </div>
    </div>
  );
}

function ItemList({
  label,
  tone,
  items,
  onToggle,
  pending,
  today,
  collapsed,
}: {
  label?: string;
  tone: "overdue" | "open" | "done";
  items: Item[];
  onToggle: (item: Item) => void;
  pending: boolean;
  today: string;
  collapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const visible = expanded ? items : items.slice(0, 0);

  return (
    <div className="mb-2">
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              tone === "overdue"
                ? "text-amber-700"
                : tone === "done"
                  ? "text-neutral-400"
                  : "text-neutral-500"
            }`}
          >
            {label}
          </p>
          {collapsed && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-neutral-500 hover:text-brand-blue"
            >
              {expanded ? "Hide" : "Show"}
            </button>
          )}
        </div>
      )}
      <ul className="space-y-1">
        {visible.map((item) => {
          const isOverdue = !item.completed && item.due_date && item.due_date < today;
          return (
            <li
              key={item.id}
              className={`flex items-start gap-2 rounded-md px-1.5 py-1 text-sm ${
                isOverdue ? "bg-amber-50 ring-1 ring-amber-200" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => onToggle(item)}
                disabled={pending}
                aria-label={item.completed ? `Re-open ${item.title}` : `Mark ${item.title} done`}
                className="mt-0.5 rounded border-neutral-300"
              />
              <div className={`min-w-0 flex-1 ${item.completed ? "text-neutral-400" : ""}`}>
                <p className={item.completed ? "line-through" : ""}>{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-[11px] text-neutral-500">{item.description}</p>
                )}
                {(item.due_date || item.completed_at) && (
                  <p
                    className={`mt-0.5 text-[11px] ${
                      isOverdue
                        ? "font-medium text-amber-800"
                        : item.completed
                          ? "text-neutral-400"
                          : "text-neutral-500"
                    }`}
                  >
                    {item.completed
                      ? `Done ${item.completed_at?.slice(0, 10) ?? ""}`
                      : item.due_date
                        ? isOverdue
                          ? `Overdue · was due ${item.due_date}`
                          : `Due ${item.due_date}`
                        : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
