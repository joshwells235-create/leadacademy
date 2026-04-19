"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ConversationListItem } from "@/lib/ai/conversation/list-conversations";
import { deleteConversation, renameConversation } from "@/lib/conversations/actions";

type Props = {
  conversations: ConversationListItem[];
  activeId: string | null;
};

export function ConversationsSidebar({ conversations, activeId }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <div className="mb-3 flex lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-navy shadow-sm hover:bg-brand-light"
        >
          {mobileOpen ? "Hide conversations" : `Conversations (${conversations.length})`}
        </button>
      </div>

      <aside className={`${mobileOpen ? "block" : "hidden"} lg:block lg:w-72 lg:flex-shrink-0`}>
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 p-3">
            <Link
              href="/coach-chat/new"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              + New conversation
            </Link>
          </div>

          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">
              No saved conversations yet — your first one will show up here.
            </div>
          ) : (
            <ConversationGroups conversations={conversations} activeId={activeId} />
          )}

          <div className="border-t border-neutral-100 p-3">
            <Link
              href="/memory"
              className="block text-center text-xs text-neutral-500 hover:text-brand-blue"
            >
              What your thought partner remembers about you →
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

function ConversationGroups({
  conversations,
  activeId,
}: {
  conversations: ConversationListItem[];
  activeId: string | null;
}) {
  const groups = groupConversations(conversations);
  return (
    <ul className="max-h-[60vh] overflow-y-auto p-2 lg:max-h-[70vh]">
      {groups.map((g) => (
        <li key={g.label} className="mb-2">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {g.label}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((c) => (
              <ConversationRow key={c.id} item={c} isActive={c.id === activeId} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({ item, isActive }: { item: ConversationListItem; isActive: boolean }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title ?? "");
  const [pending, start] = useTransition();

  const displayLabel =
    item.title && item.title.trim().length > 0
      ? item.title
      : item.previewText.slice(0, 40) || "(new conversation)";

  const handleDelete = () => {
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    start(async () => {
      const res = await deleteConversation(item.id);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      if (isActive) router.push("/coach-chat/new");
      else router.refresh();
    });
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = titleDraft.trim();
    if (!next || next === item.title) {
      setRenaming(false);
      return;
    }
    start(async () => {
      const res = await renameConversation(item.id, next);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      setRenaming(false);
      router.refresh();
    });
  };

  if (renaming) {
    return (
      <li>
        <form onSubmit={handleRenameSubmit} className="flex items-center gap-1 px-2 py-1">
          <input
            // biome-ignore lint/a11y/noAutofocus: inline rename intent
            autoFocus
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setRenaming(false);
                setTitleDraft(item.title ?? "");
              }
            }}
            disabled={pending}
            maxLength={80}
            className="flex-1 rounded border border-brand-blue bg-white px-2 py-1 text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-brand-blue px-2 py-1 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            Save
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="group relative">
      <Link
        href={`/coach-chat?c=${item.id}`}
        className={`flex flex-col rounded-md px-2 py-2 pr-8 text-sm transition ${
          isActive ? "bg-brand-blue/10 text-brand-navy" : "text-neutral-700 hover:bg-brand-light"
        }`}
      >
        <span className="line-clamp-1 font-medium">{displayLabel}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-neutral-500">
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 uppercase tracking-wide">
            {item.mode}
          </span>
          <span>{formatRelativeTime(item.lastMessageAt ?? item.createdAt)}</span>
        </span>
      </Link>
      <button
        type="button"
        aria-label="More actions"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="absolute right-1 top-1.5 rounded p-1 text-neutral-400 opacity-0 hover:bg-neutral-100 hover:text-neutral-700 focus:opacity-100 group-hover:opacity-100"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <title>More</title>
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default bg-transparent"
          />
          <div className="absolute right-1 top-8 z-20 w-32 overflow-hidden rounded-md border border-neutral-200 bg-white text-xs shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-brand-light"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleDelete();
              }}
              className="block w-full px-3 py-2 text-left text-brand-pink hover:bg-brand-light"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

type Group = { label: string; items: ConversationListItem[] };

function groupConversations(items: ConversationListItem[]): Group[] {
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;
  const today: ConversationListItem[] = [];
  const thisWeek: ConversationListItem[] = [];
  const earlier: ConversationListItem[] = [];
  for (const c of items) {
    const ts = c.lastMessageAt ?? c.createdAt;
    const age = now - new Date(ts).getTime();
    if (age < DAY) today.push(c);
    else if (age < 7 * DAY) thisWeek.push(c);
    else earlier.push(c);
  }
  const groups: Group[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (thisWeek.length) groups.push({ label: "This week", items: thisWeek });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });
  return groups;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(iso).toLocaleDateString();
}
