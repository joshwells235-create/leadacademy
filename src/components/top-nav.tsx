"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { NotificationBell } from "@/components/notifications/notification-bell";

type OrgInfo = { id: string; name: string; logo_url: string | null; slug: string } | null;
type Membership = { id: string; role: string; org: OrgInfo };

export function TopNav({
  userId,
  userEmail,
  displayName,
  superAdmin,
  unreadNotifications,
  memberships,
}: {
  userId: string;
  userEmail: string;
  displayName: string | null;
  superAdmin: boolean;
  unreadNotifications: number;
  memberships: Membership[];
}) {
  const primary = memberships[0]?.org;
  const isCoach = superAdmin || memberships.some((m) => m.role === "coach" || m.role === "org_admin");

  return (
    <header className="bg-brand-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          {primary?.logo_url ? (
            <img src={primary.logo_url} alt={primary.name} className="h-7 w-7 rounded" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-blue text-xs font-bold text-white">
              LA
            </div>
          )}
          <Link href="/dashboard" className="text-sm font-bold tracking-tight">
            {primary?.name ?? "LeadAcademy"}
          </Link>
        </div>

        {/* Primary nav — 5 items max */}
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <GrowthDropdown />
          <NavLink href="/learning">Learning</NavLink>
          <NavLink href="/community">Community</NavLink>
          <NavLink href="/messages">Messages</NavLink>
          <NavLink href="/coach-chat" accent>Coach</NavLink>
        </nav>

        {/* Right: bell + user menu */}
        <div className="flex items-center gap-2">
          <NotificationBell userId={userId} initialCount={unreadNotifications} />
          <UserMenu
            displayName={displayName}
            userEmail={userEmail}
            superAdmin={superAdmin}
            isCoach={isCoach}
            role={memberships[0]?.role}
          />
        </div>
      </div>
    </header>
  );
}

/** Dropdown for Goals / Actions / Reflections / Assessments */
function GrowthDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-white/75 transition hover:text-white hover:bg-white/10"
      >
        My Growth
        <svg className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <DropdownLink href="/goals" onClick={() => setOpen(false)}>Goals</DropdownLink>
            <DropdownLink href="/action-log" onClick={() => setOpen(false)}>Action Log</DropdownLink>
            <DropdownLink href="/reflections" onClick={() => setOpen(false)}>Reflections</DropdownLink>
            <DropdownLink href="/assessments" onClick={() => setOpen(false)}>Assessments</DropdownLink>
            <DropdownLink href="/resources" onClick={() => setOpen(false)}>Resources</DropdownLink>
          </div>
        </>
      )}
    </div>
  );
}

/** User avatar/menu with role-specific links */
function UserMenu({
  displayName,
  userEmail,
  superAdmin,
  isCoach,
  role,
}: {
  displayName: string | null;
  userEmail: string;
  superAdmin: boolean;
  isCoach: boolean;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = displayName ?? userEmail;
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-white/10"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white">
          {initials}
        </div>
        <div className="text-left text-xs hidden sm:block">
          <div className="font-medium text-white">{displayName ?? userEmail}</div>
          <div className="text-white/50">{role ?? (superAdmin ? "super admin" : "")}</div>
        </div>
        <svg className={`h-3 w-3 text-white/50 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <div className="px-3 py-2 border-b border-neutral-100">
              <div className="text-sm font-medium text-brand-navy">{displayName ?? userEmail}</div>
              <div className="text-xs text-neutral-500">{userEmail}</div>
              {superAdmin && (
                <span className="mt-1 inline-block rounded-full bg-brand-pink px-2 py-0.5 text-[10px] font-medium text-white">
                  super admin
                </span>
              )}
            </div>

            <DropdownLink href="/pre-session" onClick={() => setOpen(false)}>Pre-session Prep</DropdownLink>

            {(isCoach || superAdmin) && (
              <>
                <div className="my-1 border-t border-neutral-100" />
                <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Admin</div>
                {isCoach && <DropdownLink href="/coach/dashboard" onClick={() => setOpen(false)}>Coach Portal</DropdownLink>}
                {superAdmin && <DropdownLink href="/super/course-builder" onClick={() => setOpen(false)}>Course Builder</DropdownLink>}
              </>
            )}

            <div className="my-1 border-t border-neutral-100" />
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-brand-light transition"
                onClick={() => setOpen(false)}
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function NavLink({ href, children, accent }: { href: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 transition ${
        accent
          ? "bg-brand-pink/20 font-medium text-white hover:bg-brand-pink/30"
          : "text-white/75 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

function DropdownLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block px-3 py-2 text-sm text-neutral-700 hover:bg-brand-light transition">
      {children}
    </Link>
  );
}
