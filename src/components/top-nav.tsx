"use client";

import Link from "next/link";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { logoutAction } from "@/lib/auth/actions";

type OrgInfo = { id: string; name: string; logo_url: string | null; slug: string } | null;
type Membership = { id: string; role: string; org: OrgInfo };

export function TopNav({
  userId,
  userEmail,
  displayName,
  superAdmin,
  unreadNotifications,
  capstoneAvailable = false,
  isConsultant = false,
  memberships,
}: {
  userId: string;
  userEmail: string;
  displayName: string | null;
  superAdmin: boolean;
  unreadNotifications: number;
  capstoneAvailable?: boolean;
  isConsultant?: boolean;
  memberships: Membership[];
}) {
  const primary = memberships[0]?.org;
  const isCoach =
    superAdmin || memberships.some((m) => m.role === "coach" || m.role === "org_admin");
  const isOrgAdmin = superAdmin || memberships.some((m) => m.role === "org_admin");
  const showConsultantPortal = superAdmin || isConsultant;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-brand-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          {primary?.logo_url ? (
            <img src={primary.logo_url} alt={primary.name} className="h-7 rounded" />
          ) : (
            <img src="/leadshift-logo.svg" alt="LeadShift" className="h-6 brightness-0 invert" />
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 text-sm">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <GrowthDropdown capstoneAvailable={capstoneAvailable} />
          <NavLink href="/learning">Learning</NavLink>
          <NavLink href="/community">Community</NavLink>
          <NavLink href="/messages">Messages</NavLink>
          <NavLink href="/coach-chat" accent>
            Thought Partner
          </NavLink>
        </nav>

        {/* Right: bell + user (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-2">
          <NotificationBell userId={userId} initialCount={unreadNotifications} />
          <div className="hidden lg:block">
            <UserMenu
              displayName={displayName}
              userEmail={userEmail}
              superAdmin={superAdmin}
              isCoach={isCoach}
              isOrgAdmin={isOrgAdmin}
              isConsultant={showConsultantPortal}
              role={memberships[0]?.role}
            />
          </div>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden rounded-md p-1.5 text-white/75 hover:text-white transition"
            aria-label="Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {mobileOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 px-4 pb-4 pt-2 space-y-1 animate-in slide-in-from-top-2">
          <MobileLink href="/dashboard" onClick={() => setMobileOpen(false)}>
            Dashboard
          </MobileLink>
          <MobileLink href="/goals" onClick={() => setMobileOpen(false)}>
            Goals
          </MobileLink>
          <MobileLink href="/action-log" onClick={() => setMobileOpen(false)}>
            Action Log
          </MobileLink>
          <MobileLink href="/reflections" onClick={() => setMobileOpen(false)}>
            Reflections
          </MobileLink>
          <MobileLink href="/assessments" onClick={() => setMobileOpen(false)}>
            Assessments
          </MobileLink>
          <MobileLink href="/resources" onClick={() => setMobileOpen(false)}>
            Resources
          </MobileLink>
          <MobileLink href="/certificates" onClick={() => setMobileOpen(false)}>
            Certificates
          </MobileLink>
          {capstoneAvailable && (
            <MobileLink href="/capstone" onClick={() => setMobileOpen(false)}>
              Capstone
            </MobileLink>
          )}
          <MobileLink href="/learning" onClick={() => setMobileOpen(false)}>
            Learning
          </MobileLink>
          <MobileLink href="/community" onClick={() => setMobileOpen(false)}>
            Community
          </MobileLink>
          <MobileLink href="/messages" onClick={() => setMobileOpen(false)}>
            Messages
          </MobileLink>
          <MobileLink href="/coach-chat" onClick={() => setMobileOpen(false)} accent>
            Thought Partner
          </MobileLink>
          <MobileLink href="/profile" onClick={() => setMobileOpen(false)}>
            Your profile
          </MobileLink>
          <MobileLink href="/pre-session" onClick={() => setMobileOpen(false)}>
            Pre-session Prep
          </MobileLink>
          {(isOrgAdmin || superAdmin || isCoach || showConsultantPortal) && (
            <MobileSection>Portals</MobileSection>
          )}
          {(isOrgAdmin || superAdmin) && (
            <MobileLink href="/admin/dashboard" onClick={() => setMobileOpen(false)}>
              Admin
            </MobileLink>
          )}
          {isCoach && (
            <MobileLink href="/coach/dashboard" onClick={() => setMobileOpen(false)}>
              Coach
            </MobileLink>
          )}
          {showConsultantPortal && (
            <MobileLink href="/consultant/dashboard" onClick={() => setMobileOpen(false)}>
              Consultant
            </MobileLink>
          )}
          {superAdmin && (
            <>
              <MobileSection>People &amp; access</MobileSection>
              <MobileLink href="/super/orgs" onClick={() => setMobileOpen(false)}>
                Organizations
              </MobileLink>
              <MobileLink href="/super/users" onClick={() => setMobileOpen(false)}>
                Users
              </MobileLink>
              <MobileLink href="/super/invitations" onClick={() => setMobileOpen(false)}>
                Invitations
              </MobileLink>

              <MobileSection>Content</MobileSection>
              <MobileLink href="/super/course-builder" onClick={() => setMobileOpen(false)}>
                Course Builder
              </MobileLink>
              <MobileLink href="/super/learning-paths" onClick={() => setMobileOpen(false)}>
                Learning Paths
              </MobileLink>
              <MobileLink href="/super/certificates" onClick={() => setMobileOpen(false)}>
                Certificates
              </MobileLink>

              <MobileSection>Insights</MobileSection>
              <MobileLink href="/super/ai-usage" onClick={() => setMobileOpen(false)}>
                AI Usage
              </MobileLink>
              <MobileLink href="/super/activity" onClick={() => setMobileOpen(false)}>
                Activity Log
              </MobileLink>
            </>
          )}
          <div className="my-2 border-t border-white/10" />
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-white">{displayName ?? userEmail}</div>
            <div className="text-xs text-white/50">
              {memberships[0]?.role ?? (superAdmin ? "super admin" : "")}
            </div>
          </div>
          {/* Do NOT close the menu on click — setMobileOpen(false) unmounts this
              form before the browser submits it, so logoutAction never runs.
              The redirect inside logoutAction replaces the page anyway. */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 transition"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}

function GrowthDropdown({ capstoneAvailable }: { capstoneAvailable: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-white/75 transition hover:text-white hover:bg-white/10"
        aria-haspopup="true"
        aria-expanded={open}
      >
        My Growth
        <svg
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <DropdownLink href="/goals" onClick={() => setOpen(false)}>
              Goals
            </DropdownLink>
            <DropdownLink href="/action-log" onClick={() => setOpen(false)}>
              Action Log
            </DropdownLink>
            <DropdownLink href="/reflections" onClick={() => setOpen(false)}>
              Reflections
            </DropdownLink>
            <DropdownLink href="/assessments" onClick={() => setOpen(false)}>
              Assessments
            </DropdownLink>
            <DropdownLink href="/certificates" onClick={() => setOpen(false)}>
              Certificates
            </DropdownLink>
            <DropdownLink href="/resources" onClick={() => setOpen(false)}>
              Resources
            </DropdownLink>
            {capstoneAvailable && (
              <>
                <div className="my-1 border-t border-neutral-100" />
                <DropdownLink href="/capstone" onClick={() => setOpen(false)}>
                  Capstone ✨
                </DropdownLink>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu({
  displayName,
  userEmail,
  superAdmin,
  isCoach,
  isOrgAdmin,
  isConsultant,
  role,
}: {
  displayName: string | null;
  userEmail: string;
  superAdmin: boolean;
  isCoach: boolean;
  isOrgAdmin: boolean;
  isConsultant: boolean;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = displayName ?? userEmail;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-white/10"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white">
          {initials}
        </div>
        <div className="text-left text-xs hidden sm:block">
          <div className="font-medium text-white">{displayName ?? userEmail}</div>
          <div className="text-white/50">{role ?? (superAdmin ? "super admin" : "")}</div>
        </div>
        <svg
          className={`h-3 w-3 text-white/50 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
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
                <span className="mt-1 inline-block rounded-full bg-brand-navy px-2 py-0.5 text-[10px] font-medium text-white">
                  super admin
                </span>
              )}
            </div>
            <DropdownLink href="/profile" onClick={() => setOpen(false)}>
              Your profile
            </DropdownLink>
            <DropdownLink href="/memory" onClick={() => setOpen(false)}>
              What your thought partner remembers
            </DropdownLink>
            <DropdownLink href="/pre-session" onClick={() => setOpen(false)}>
              Pre-session Prep
            </DropdownLink>
            {(isCoach || isOrgAdmin || superAdmin || isConsultant) && (
              <>
                <DropdownSection>Portals</DropdownSection>
                {(isOrgAdmin || superAdmin) && (
                  <DropdownLink href="/admin/dashboard" onClick={() => setOpen(false)}>
                    Admin
                  </DropdownLink>
                )}
                {isCoach && (
                  <DropdownLink href="/coach/dashboard" onClick={() => setOpen(false)}>
                    Coach
                  </DropdownLink>
                )}
                {isConsultant && (
                  <DropdownLink href="/consultant/dashboard" onClick={() => setOpen(false)}>
                    Consultant
                  </DropdownLink>
                )}
                {superAdmin && (
                  <>
                    <DropdownSection>People &amp; access</DropdownSection>
                    <DropdownLink href="/super/orgs" onClick={() => setOpen(false)}>
                      Organizations
                    </DropdownLink>
                    <DropdownLink href="/super/users" onClick={() => setOpen(false)}>
                      Users
                    </DropdownLink>
                    <DropdownLink href="/super/invitations" onClick={() => setOpen(false)}>
                      Invitations
                    </DropdownLink>

                    <DropdownSection>Content</DropdownSection>
                    <DropdownLink href="/super/course-builder" onClick={() => setOpen(false)}>
                      Course Builder
                    </DropdownLink>
                    <DropdownLink href="/super/learning-paths" onClick={() => setOpen(false)}>
                      Learning Paths
                    </DropdownLink>
                    <DropdownLink href="/super/certificates" onClick={() => setOpen(false)}>
                      Certificates
                    </DropdownLink>
                    <DropdownLink href="/super/resources" onClick={() => setOpen(false)}>
                      Resource Library
                    </DropdownLink>

                    <DropdownSection>Communication</DropdownSection>
                    <DropdownLink href="/super/announcements" onClick={() => setOpen(false)}>
                      Announcements
                    </DropdownLink>
                    <DropdownLink href="/super/moderation" onClick={() => setOpen(false)}>
                      Moderation
                    </DropdownLink>

                    <DropdownSection>Insights</DropdownSection>
                    <DropdownLink href="/super/ai-usage" onClick={() => setOpen(false)}>
                      AI Usage
                    </DropdownLink>
                    <DropdownLink href="/super/conversations" onClick={() => setOpen(false)}>
                      AI Conversations
                    </DropdownLink>
                    <DropdownLink href="/super/activity" onClick={() => setOpen(false)}>
                      Activity Log
                    </DropdownLink>
                    <DropdownLink href="/super/ai-errors" onClick={() => setOpen(false)}>
                      AI Errors
                    </DropdownLink>
                    <DropdownLink href="/super/export" onClick={() => setOpen(false)}>
                      Data Export
                    </DropdownLink>
                  </>
                )}
              </>
            )}
            <div className="my-1 border-t border-neutral-100" />
            {/* Do NOT close the dropdown on click — setOpen(false) unmounts the
                form inside this `{open && (...)}` block before the browser can
                submit it, so logoutAction never runs. The redirect inside
                logoutAction unmounts everything anyway. */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-brand-light transition"
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

function NavLink({
  href,
  children,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  /** `accent` used to paint the Thought Partner link pink. Pink is now
   * reserved for the voice of the AI itself — inside the chat surface only.
   * The nav stays monochrome; entering the chat is where the color appears. */
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 transition ${accent ? "font-medium text-white hover:bg-white/10" : "text-white/75 hover:text-white hover:bg-white/10"}`}
    >
      {children}
    </Link>
  );
}

function DropdownLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-brand-light transition"
    >
      {children}
    </Link>
  );
}

/**
 * Small-caps section label inside a dropdown. Renders a subtle divider
 * above itself (except when it's the first child) so grouped links
 * read as a scannable list instead of a wall of text.
 */
function DropdownSection({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mt-1.5 mb-0.5 border-t border-neutral-100 pt-1.5" />
      <div className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {children}
      </div>
    </>
  );
}

function MobileLink({
  href,
  children,
  onClick,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-md px-3 py-2 text-sm transition ${accent ? "font-medium text-white hover:bg-white/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

function MobileSection({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mt-3 mb-0.5 border-t border-white/10 pt-2" />
      <div className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        {children}
      </div>
    </>
  );
}
