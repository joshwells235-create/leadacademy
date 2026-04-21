"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ConversationListItem } from "@/lib/ai/conversation/list-conversations";
import { deleteConversation, renameConversation } from "@/lib/conversations/actions";

// The Thought Partner chat rail. Three sections:
//
//   1. THIS THREAD — the active conversation's title, rendered in serif
//      so it reads as a heading. Rename / delete live on the overflow
//      menu beside the title.
//   2. GROUNDED IN — the context sources the current thread is reading
//      from (sprint actions, reflections, recap, memory facts, etc.),
//      each marked with a pink dot. Same transparency gesture as the
//      dashboard TP hero modal, but condensed into a rail.
//   3. EARLIER THREADS — a scrollable list of priors, grouped
//      Today / This week / Earlier. Clicking one resumes it. Each row
//      gets its own overflow menu for rename + delete.
//
// Plus: "+ New conversation" button at the top, "/memory" link at the
// bottom — both retained from the pre-redesign sidebar.
type Props = {
  conversations: ConversationListItem[];
  activeId: string | null;
  activeTitle: string | null;
  activeMode: string | null;
  groundedIn: string[];
};

export function ConversationsSidebar({
  conversations,
  activeId,
  activeTitle,
  activeMode,
  groundedIn,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const earlier = conversations.filter((c) => c.id !== activeId);

  return (
    <>
      {/* Mobile toggle — rail is hidden by default on small screens and
          expanded only when the learner asks for it. */}
      <div className="mb-3 flex lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft transition hover:text-ink"
          style={{ borderColor: "var(--t-rule)" }}
        >
          {mobileOpen ? "Hide threads" : `Threads (${conversations.length})`}
        </button>
      </div>

      <aside
        className={`${mobileOpen ? "block" : "hidden"} lg:block lg:w-[280px] lg:flex-shrink-0`}
      >
        <div
          className="flex h-full flex-col gap-7 pr-0 lg:pr-6"
          style={{
            // A rule to the right of the rail on desktop — separates it
            // from the message column without drawing a full panel around
            // the sidebar. Matches the editorial "print gutter" feel.
            borderRight: undefined,
          }}
        >
          {/* New conversation */}
          <Link
            href="/coach-chat/new"
            className="inline-flex w-fit items-center rounded-full px-4 py-2 text-[12px] font-medium text-white transition"
            style={{
              background: "var(--t-accent)",
              boxShadow: "0 4px 20px var(--t-accent-soft)",
            }}
          >
            + New conversation
          </Link>

          {/* THIS THREAD */}
          {activeId && activeTitle ? (
            <ThisThreadSection
              activeId={activeId}
              title={activeTitle}
              mode={activeMode}
            />
          ) : (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                This thread
              </p>
              <p className="mt-2.5 text-[13px] leading-[1.55] text-ink-soft">
                Start a new thread to see it here.
              </p>
            </div>
          )}

          {/* GROUNDED IN */}
          {groundedIn.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Grounded in
              </p>
              <ul className="mt-2.5 space-y-2">
                {groundedIn.map((src) => (
                  <li
                    key={src}
                    className="flex items-start gap-2 text-[12.5px] leading-[1.5] text-ink-soft"
                  >
                    <span aria-hidden className="shrink-0 text-accent">
                      ·
                    </span>
                    <span>{src}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* EARLIER THREADS */}
          {earlier.length > 0 && (
            <div className="min-h-0 flex-1">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Earlier threads
              </p>
              <EarlierList conversations={earlier} activeId={activeId} />
            </div>
          )}

          {/* Memory link — the transparency / privacy shortcut. */}
          <Link
            href="/memory"
            className="mt-auto inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft transition hover:text-ink"
          >
            What your TP remembers →
          </Link>
        </div>
      </aside>
    </>
  );
}

// ─── THIS THREAD ──────────────────────────────────────────────────────
function ThisThreadSection({
  activeId,
  title,
  mode,
}: {
  activeId: string;
  title: string;
  mode: string | null;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, start] = useTransition();

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = titleDraft.trim();
    if (!next) {
      setRenameError("Title can't be empty.");
      return;
    }
    start(async () => {
      const res = await renameConversation(activeId, next);
      if ("error" in res && res.error) {
        setRenameError(res.error);
        return;
      }
      setRenaming(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    start(async () => {
      const res = await deleteConversation(activeId);
      if ("error" in res && res.error) return;
      router.push("/coach-chat/new");
    });
  };

  return (
    <div className="relative">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        This thread
      </p>
      {renaming ? (
        <form onSubmit={handleRenameSubmit} className="mt-2.5">
          <input
            // biome-ignore lint/a11y/noAutofocus: inline rename intent
            autoFocus
            type="text"
            value={titleDraft}
            onChange={(e) => {
              setTitleDraft(e.target.value);
              if (renameError) setRenameError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setRenaming(false);
                setTitleDraft(title);
                setRenameError(null);
              }
            }}
            disabled={pending}
            className="w-full rounded-md px-2 py-1.5 text-[14px] text-ink outline-none"
            style={{
              background: "var(--t-paper)",
              border: "1px solid var(--t-accent)",
            }}
          />
          {renameError && (
            <p className="mt-1 text-[11px] text-accent">{renameError}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full px-3 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--t-accent)" }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setTitleDraft(title);
              }}
              className="text-[11px] text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="group relative mt-2.5">
          <h2
            className="pr-7 leading-[1.25] text-ink"
            style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 400 }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Thread actions"
            onClick={() => setMenuOpen((v) => !v)}
            className="absolute right-0 top-0 rounded p-1 text-ink-faint transition hover:text-ink focus:text-ink"
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
              <div
                className="absolute right-0 top-6 z-20 w-32 overflow-hidden text-xs"
                style={{
                  background: "var(--t-paper)",
                  border: "1px solid var(--t-rule)",
                  borderRadius: "var(--t-radius-lg)",
                  boxShadow: "var(--t-panel-shadow)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setRenaming(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-ink-soft hover:text-ink"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingDelete(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-accent hover:opacity-80"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {mode && !renaming && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
          Mode · {mode.replace(/_/g, " ")}
        </p>
      )}
      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-label="Delete conversation"
          className="mt-3 rounded-md p-2.5 text-[12px]"
          style={{
            background: "var(--t-accent-soft)",
            border: "1px solid var(--t-rule)",
          }}
        >
          <p className="text-ink">Delete this conversation? This can't be undone.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-full px-3 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--t-accent)" }}
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
              className="text-[11px] text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EARLIER THREADS ──────────────────────────────────────────────────
// Grouped by recency. Each row links to `?c=<id>`; the design calls
// for a minimal presentation — titles only, no preview body text,
// subtle mode + timestamp underneath.
function EarlierList({
  conversations,
  activeId,
}: {
  conversations: ConversationListItem[];
  activeId: string | null;
}) {
  const groups = groupConversations(conversations);
  return (
    <ul className="max-h-[45vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[50vh]">
      {groups.map((g) => (
        <li key={g.label}>
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
            {g.label}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((c) => (
              <EarlierRow key={c.id} item={c} isActive={c.id === activeId} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EarlierRow({
  item,
  isActive,
}: {
  item: ConversationListItem;
  isActive: boolean;
}) {
  const displayLabel =
    item.title && item.title.trim().length > 0
      ? item.title
      : item.previewText.slice(0, 40) || "(new conversation)";

  return (
    <li>
      <Link
        href={`/coach-chat?c=${item.id}`}
        className={`block py-1 text-[12.5px] transition ${
          isActive ? "text-ink" : "text-ink-soft hover:text-ink"
        }`}
      >
        <span className="line-clamp-1">{displayLabel}</span>
        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {item.mode.replace(/_/g, " ")} ·{" "}
          {formatRelativeTime(item.lastMessageAt ?? item.createdAt)}
        </span>
      </Link>
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
