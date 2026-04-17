"use client";

import { useTransition } from "react";
import { toggleActionItem } from "@/lib/coach/actions";

export function ActionItemToggle({ item }: { item: { id: string; title: string; due_date: string | null; completed: boolean } }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => start(async () => { await toggleActionItem(item.id); })}
        disabled={pending}
        className="mt-0.5 rounded border-neutral-300"
      />
      <div className={item.completed ? "line-through text-neutral-400" : ""}>
        {item.title}
        {item.due_date && <span className="text-xs text-neutral-500 ml-1">due {item.due_date}</span>}
      </div>
    </li>
  );
}
