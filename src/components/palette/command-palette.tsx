"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { type PersonHit, searchPeople } from "@/lib/palette/search-people";

type NavItem = {
  kind: "nav";
  label: string;
  href: string;
  section: string;
};
type PersonItem = {
  kind: "person";
  hit: PersonHit;
};
type Item = NavItem | PersonItem;

type Props = {
  /** Caller role context, drives which nav items appear + whether
   *  search is enabled. */
  isStaff: boolean;
  superAdmin: boolean;
  isCoach: boolean;
  isOrgAdmin: boolean;
  isConsultant: boolean;
  coachPrimary: boolean;
  capstoneAvailable: boolean;
};

/**
 * ⌘K / Ctrl+K global command palette. Mounted in the app layout so
 * every authenticated route shares it. Two surfaces inside:
 *
 * 1. Static nav list — every route in the caller's nav, filtered by
 *    role context. No backend call.
 * 2. Staff people search — typing 2+ chars hits `searchPeople` which
 *    returns a scoped list of profile matches with the right deep link
 *    for the caller's role.
 *
 * Keyboard: ↑/↓ move selection, Enter activates, Esc closes.
 */
export function CommandPalette(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const navItems = useMemo(() => buildNavItems(props), [props]);

  // Global keybind. Mount-time only — fires on every key event regardless of
  // which route the user is on.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // When the palette opens, focus the input and reset selection.
  useEffect(() => {
    if (!open) return;
    setSelected(0);
    setQuery("");
    setPeople([]);
    // Defer focus so the input is mounted.
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced search. Hits the server action 200ms after the last keystroke.
  useEffect(() => {
    if (!props.isStaff) return;
    const q = query.trim();
    if (q.length < 2) {
      setPeople([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const hits = await searchPeople(q);
          setPeople(hits);
        } catch {
          setPeople([]);
        }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, props.isStaff]);

  // Filtered nav list — substring match on label.
  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((n) => n.label.toLowerCase().includes(q));
  }, [navItems, query]);

  // Combined item list for keyboard navigation. People first (most
  // specific intent), then nav.
  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    for (const hit of people) list.push({ kind: "person", hit });
    // filteredNav items already are NavItems (kind === "nav" baked in);
    // push them directly rather than re-spread-with-kind, which trips
    // TS's no-duplicate-keys rule on production builds.
    for (const nav of filteredNav) list.push(nav);
    return list;
  }, [people, filteredNav]);

  // Reset selected index when the result set changes.
  useEffect(() => {
    setSelected(0);
  }, [items.length]);

  const activate = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.kind === "nav") {
        router.push(item.href);
      } else {
        router.push(item.hit.href);
      }
    },
    [router],
  );

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter" && items[selected]) {
      e.preventDefault();
      activate(items[selected]);
    }
  };

  if (!open) {
    // Render the trigger badge in the corner so the keybind is
    // discoverable on a fresh load. Keyboard-only is fine for now —
    // the top-nav can host the visible button separately.
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick navigation"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh]"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden"
        style={{
          background: "var(--t-paper)",
          border: "1px solid var(--t-rule)",
          borderRadius: "var(--t-radius-lg)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--t-rule)" }}
        >
          <span
            aria-hidden
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint"
          >
            ⌘K
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={
              props.isStaff
                ? "Go to a page or search for someone…"
                : "Go to a page…"
            }
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
          {pending && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              …
            </span>
          )}
        </div>

        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-soft">
              {query.trim().length < 2 && props.isStaff
                ? "Type 2+ characters to search for a learner."
                : "No matches."}
            </li>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selected;
              const key =
                item.kind === "nav"
                  ? `nav:${item.href}`
                  : `person:${item.hit.user_id}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => activate(item)}
                    onMouseEnter={() => setSelected(idx)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition"
                    style={{
                      background: isSelected ? "var(--t-accent-soft)" : "transparent",
                      color: isSelected ? "var(--t-ink)" : "var(--t-ink-soft)",
                    }}
                  >
                    {item.kind === "nav" ? (
                      <>
                        <span className="truncate">{item.label}</span>
                        <span
                          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint"
                        >
                          {item.section}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-ink">
                            {item.hit.display_name ?? "Unnamed"}
                          </span>
                          {item.hit.email && (
                            <span className="ml-2 text-ink-faint">
                              {item.hit.email}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                          {item.hit.org_name ?? item.hit.role_label}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div
          className="flex items-center justify-between gap-3 px-4 py-2 text-[10px]"
          style={{
            borderTop: "1px solid var(--t-rule)",
            color: "var(--t-ink-faint)",
          }}
        >
          <span className="font-mono uppercase tracking-[0.15em]">
            ↑↓ navigate · Enter open · Esc close
          </span>
          <span>
            <kbd className="font-mono">⌘K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}

function buildNavItems(p: Props): NavItem[] {
  const items: NavItem[] = [];

  // Learner / shared nav
  if (p.coachPrimary) {
    items.push(
      { kind: "nav", label: "Coaching Home", href: "/coach/dashboard", section: "Today" },
      { kind: "nav", label: "Journal", href: "/coach/journal", section: "Coach" },
    );
  } else {
    items.push(
      { kind: "nav", label: "Today", href: "/dashboard", section: "Home" },
      { kind: "nav", label: "Goals", href: "/goals", section: "Growth" },
      { kind: "nav", label: "Action Log", href: "/action-log", section: "Growth" },
      { kind: "nav", label: "Reflections", href: "/reflections", section: "Growth" },
      { kind: "nav", label: "Assessments", href: "/assessments", section: "Growth" },
      { kind: "nav", label: "Certificates", href: "/certificates", section: "Growth" },
      { kind: "nav", label: "Resources", href: "/resources", section: "Growth" },
    );
    if (p.capstoneAvailable) {
      items.push({ kind: "nav", label: "Capstone", href: "/capstone", section: "Growth" });
    }
  }

  items.push(
    { kind: "nav", label: "Learn", href: "/learning", section: "Home" },
    { kind: "nav", label: "Community", href: "/community", section: "Home" },
    { kind: "nav", label: "Messages", href: "/messages", section: "Home" },
    { kind: "nav", label: "Thought Partner", href: "/coach-chat", section: "Home" },
    { kind: "nav", label: "Your profile", href: "/profile", section: "You" },
  );

  if (!p.coachPrimary) {
    items.push(
      { kind: "nav", label: "What your thought partner remembers", href: "/memory", section: "You" },
      { kind: "nav", label: "Pre-session Prep", href: "/pre-session", section: "You" },
    );
  }

  // Portals
  if (p.isOrgAdmin || p.superAdmin) {
    items.push(
      { kind: "nav", label: "Org Admin · Dashboard", href: "/admin/dashboard", section: "Portal" },
      { kind: "nav", label: "Org Admin · People", href: "/admin/people", section: "Portal" },
      { kind: "nav", label: "Org Admin · Cohorts", href: "/admin/cohorts", section: "Portal" },
      { kind: "nav", label: "Org Admin · Activity Log", href: "/admin/activity", section: "Portal" },
    );
  }
  if (p.isCoach) {
    items.push(
      { kind: "nav", label: "Coach · Dashboard", href: "/coach/dashboard", section: "Portal" },
      { kind: "nav", label: "Coach · Journal", href: "/coach/journal", section: "Portal" },
    );
  }
  if (p.isConsultant) {
    items.push(
      { kind: "nav", label: "Consultant · Dashboard", href: "/consultant/dashboard", section: "Portal" },
    );
  }
  if (p.superAdmin) {
    items.push(
      { kind: "nav", label: "Super · Organizations", href: "/super/orgs", section: "Super" },
      { kind: "nav", label: "Super · Users", href: "/super/users", section: "Super" },
      { kind: "nav", label: "Super · Invitations", href: "/super/invitations", section: "Super" },
      { kind: "nav", label: "Super · Course Builder", href: "/super/course-builder", section: "Super" },
      { kind: "nav", label: "Super · Learning Paths", href: "/super/learning-paths", section: "Super" },
      { kind: "nav", label: "Super · Certificates", href: "/super/certificates", section: "Super" },
      { kind: "nav", label: "Super · Resources", href: "/super/resources", section: "Super" },
      { kind: "nav", label: "Super · Announcements", href: "/super/announcements", section: "Super" },
      { kind: "nav", label: "Super · Moderation", href: "/super/moderation", section: "Super" },
      { kind: "nav", label: "Super · AI Usage", href: "/super/ai-usage", section: "Super" },
      { kind: "nav", label: "Super · AI Conversations", href: "/super/conversations", section: "Super" },
      { kind: "nav", label: "Super · AI Errors", href: "/super/ai-errors", section: "Super" },
      { kind: "nav", label: "Super · Activity Log", href: "/super/activity", section: "Super" },
      { kind: "nav", label: "Super · Data Export", href: "/super/export", section: "Super" },
    );
  }

  return items;
}

// Silence unused-import lint when Link isn't used (kept for future
// preview-on-hover follow-ups).
export type _Reserve = typeof Link;
