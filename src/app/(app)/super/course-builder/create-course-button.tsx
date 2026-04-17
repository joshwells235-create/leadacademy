"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCourse } from "@/lib/learning/actions";

export function CreateCourseButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
        + New course
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => {
      const res = await createCourse(title);
      if ("id" in res) router.push(`/super/course-builder/${res.id}`);
    }); }} className="flex gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title..." className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" autoFocus />
      <button type="submit" disabled={pending || !title.trim()} className="rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark disabled:opacity-60">Create</button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500">Cancel</button>
    </form>
  );
}
