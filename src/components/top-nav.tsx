"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccentWord } from "@/components/design/accent-word";
import { DensityToggle } from "@/components/design/density-toggle";
import { ModeToggle } from "@/components/design/mode-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { logoutAction } from "@/lib/auth/actions";
import type { ThemeMode } from "@/lib/design/tokens";
import { cn } from "@/lib/utils/cn";

type OrgInfo = { id: string; name: string; logo_url: string | null; slug: string } | null;
type Membership = { id: string; role: string; org: OrgInfo };

// ─── Chrome rebuild — Editorial/Cinematic design system ───────────────────
//
// Structure preserved from the pre-redesign nav: learner / coach-primary
// variants, My Growth dropdown, portal links, avatar dropdown with all
// role-specific links, mobile drawer, notification bell. Only the visual
// language changes — every surface reads from the themed CSS variables.
//
// Signature elements from the new design:
//   • "Leadership Academy" lockup (Fraunces + Instrument Serif italic accent)
//   • Mono date strip beside the lockup
//   • 2px accent underline on the active top-level route
//   • Accent dot on the Thought Partner link (the "doorway" into the room
//     where the AI speaks — same pink, different job)
//   • Mode toggle pill (Editorial ↔ Cinematic) on the right cluster
//   • Density toggle pill (Focus ↔ Overview) — dashboard only
//   • Avatar: 30×30 accent-filled circle with a Fraunces initial
export function TopNav({
  userId,
  userEmail,
  displayName,
  superAdmin,
  unreadNotifications,
  capstoneAvailable = false,
  isConsultant = false,
  coachPrimary = false,
  memberships,
  themeMode,
  dateLabel,
}: {
  userId: string;
  userEmail: string;
  displayName: string | null;
  superAdmin: boolean;
  unreadNotifications: number;
  capstoneAvailable?: boolean;
  isConsultant?: boolean;
  coachPrimary?: boolean;
  memberships: Membership[];
  themeMode: ThemeMode;
  /** Short mono-voiced date string shown beside the brand lockup,
   *  e.g. "Tue 21 Apr". Computed server-side in the layout so SSR output
   *  matches the client's first paint. */
  dateLabel: string;
}) {
  const isCoach =
    superAdmin || memberships.some((m) => m.role === "coach" || m.role === "org_admin");
  const isOrgAdmin = superAdmin || memberships.some((m) => m.role === "org_admin");
  const showConsultantPortal = superAdmin || isConsultant;
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Density toggle is a dashboard-only affordance. Mount it when the
  // learner is looking at the "today" surface in either variant.
  const showDensity =
    pathname === "/dashboard" ||
    pathname === "/coach/dashboard" ||
    pathname === "/";

  const homeHref = coachPrimary ? "/coach/dashboard" : "/dashboard";

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-[20px] transition-colors duration-500"
      style={{
        background: "var(--t-chrome-bg)",
        borderBottom: "1px solid var(--t-rule)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-9 lg:py-4">
        {/* Brand lockup + mono date label */}
        <div className="flex items-center gap-5 shrink-0">
          <Link
            href={homeHref}
            className="flex items-baseline gap-3 leading-none"
            aria-label="Leadership Academy — Home"
          >
            <span
              className="text-xl tracking-[-0.01em] text-ink"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
            >
              Leadership <AccentWord>Academy</AccentWord>
            </span>
          </Link>
          <span className="hidden md:block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            {dateLabel}
          </span>
        </div>

        {/* Primary nav — full structure preserved, reskinned. */}
        <nav className="hidden lg:flex items-center gap-1 text-[13px]">
          {coachPrimary ? (
            <>
              <NavLink href="/coach/dashboard" pathname={pathname}>
                Coaching Home
              </NavLink>
              <NavLink href="/coach/journal" pathname={pathname}>
                Journal
              </NavLink>
              <NavLink href="/learning" pathname={pathname}>
                Learning
              </NavLink>
              <NavLink href="/community" pathname={pathname}>
                Community
              </NavLink>
              <NavLink href="/resources" pathname={pathname}>
                Resources
              </NavLink>
              <NavLink href="/messages" pathname={pathname}>
                Messages
              </NavLink>
              <NavLink href="/coach-chat" pathname={pathname} accent>
                Thought Partner
              </NavLink>
            </>
          ) : (
            <>
              <NavLink href="/dashboard" pathname={pathname}>
                Today
              </NavLink>
              <GrowthDropdown capstoneAvailable={capstoneAvailable} pathname={pathname} />
              <NavLink href="/learning" pathname={pathname}>
                Learn
              </NavLink>
              <NavLink href="/community" pathname={pathname}>
                Community
              </NavLink>
              <NavLink href="/messages" pathname={pathname}>
                Messages
              </NavLink>
              <NavLink href="/coach-chat" pathname={pathname} accent>
                Thought Partner
              </NavLink>
            </>
          )}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2.5">
          <NotificationBell userId={userId} initialCount={unreadNotifications} />
          <div className="hidden md:block">
            <ModeToggle current={themeMode} />
          </div>
          {showDensity && (
            <div className="hidden md:block">
              <DensityToggle />
            </div>
          )}
          <div className="hidden lg:block">
            <UserMenu
              displayName={displayName}
              userEmail={userEmail}
              superAdmin={superAdmin}
              isCoach={isCoach}
              isOrgAdmin={isOrgAdmin}
              isConsultant={showConsultantPortal}
              coachPrimary={coachPrimary}
              role={memberships[0]?.role}
            />
          </div>
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden rounded-md p-1.5 text-ink-soft hover:text-ink transition"
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden space-y-1 px-4 pb-4 pt-2 animate-in slide-in-from-top-2"
          style={{ borderTop: "1px solid var(--t-rule)" }}
        >
          {/* Mode + density live in the drawer on mobile — the chrome
              doesn't have room beside the hamburger. */}
          <div className="flex items-center gap-2 px-1 py-2">
            <ModeToggle current={themeMode} />
            {showDensity && <DensityToggle />}
          </div>

          {coachPrimary ? (
            <>
              <MobileLink href="/coach/dashboard" onClick={() => setMobileOpen(false)}>
                Coaching Home
              </MobileLink>
              <MobileLink href="/coach/journal" onClick={() => setMobileOpen(false)}>
                Journal
              </MobileLink>
              <MobileLink href="/learning" onClick={() => setMobileOpen(false)}>
                Learning
              </MobileLink>
              <MobileLink href="/community" onClick={() => setMobileOpen(false)}>
                Community
              </MobileLink>
              <MobileLink href="/resources" onClick={() => setMobileOpen(false)}>
                Resources
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
            </>
          ) : (
            <>
              <MobileLink href="/dashboard" onClick={() => setMobileOpen(false)}>
                Today
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
                Learn
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
            </>
          )}
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
          <div className="my-2" style={{ borderTop: "1px solid var(--t-rule)" }} />
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-ink">{displayName ?? userEmail}</div>
            <div className="text-xs text-ink-faint">
              {memberships[0]?.role ?? (superAdmin ? "super admin" : "")}
            </div>
          </div>
          {/* Do NOT close the menu on click — setMobileOpen(false) unmounts this
              form before the browser submits it, so logoutAction never runs.
              The redirect inside logoutAction replaces the page anyway. */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-md px-3 py-2 text-sm text-ink-soft hover:text-ink transition"
              style={{ background: "transparent" }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}

// ─── Top-level nav link ──────────────────────────────────────────────────
//
// Active route gets a 2px accent underline that starts at the label's
// inner padding (so the underline feels bound to the word, not the
// button chrome). The `accent` flag marks the Thought Partner link —
// brand commitment is that pink = the AI's voice, and this little dot
// is the doorway into the room where the AI speaks.
function NavLink({
  href,
  children,
  pathname,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  pathname: string | null;
  accent?: boolean;
}) {
  const active = isActiveRoute(pathname, href);
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3.5 py-2 transition-colors",
        active ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
      )}
    >
      {accent && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--t-accent)" }}
        />
      )}
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute left-3.5 right-3.5 bottom-1 h-0.5 rounded-[1px]"
          style={{ background: "var(--t-accent)" }}
        />
      )}
    </Link>
  );
}

// Match the top-level route prefix so sub-routes (e.g. /learning/123/lesson/4)
// still light up the "Learn" tab. Dashboard is special — only exact match.
function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard" || href === "/coach/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Growth dropdown ─────────────────────────────────────────────────────
function GrowthDropdown({
  capstoneAvailable,
  pathname,
}: {
  capstoneAvailable: boolean;
  pathname: string | null;
}) {
  const [open, setOpen] = useState(false);
  // "Growth" groups the goal + reflection + assessment + certificate
  // surfaces. Consider the dropdown active when the learner is on any
  // of its children.
  const active =
    !!pathname &&
    ["/goals", "/action-log", "/reflections", "/assessments", "/certificates", "/resources", "/capstone"].some(
      (h) => pathname === h || pathname.startsWith(`${h}/`),
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3.5 py-2 transition-colors",
          active ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
        )}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Growth
        <svg
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {active && (
          <span
            aria-hidden
            className="absolute left-3.5 right-7 bottom-1 h-0.5 rounded-[1px]"
            style={{ background: "var(--t-accent)" }}
          />
        )}
      </button>
      {open && (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-50 mt-2 w-52 py-1"
            style={{
              background: "var(--t-paper)",
              border: "1px solid var(--t-rule)",
              borderRadius: "var(--t-radius-lg)",
              boxShadow: "var(--t-panel-shadow)",
            }}
          >
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
                <DropdownDivider />
                <DropdownLink href="/capstone" onClick={() => setOpen(false)}>
                  Capstone
                </DropdownLink>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── User / avatar dropdown ──────────────────────────────────────────────
function UserMenu({
  displayName,
  userEmail,
  superAdmin,
  isCoach,
  isOrgAdmin,
  isConsultant,
  coachPrimary,
  role,
}: {
  displayName: string | null;
  userEmail: string;
  superAdmin: boolean;
  isCoach: boolean;
  isOrgAdmin: boolean;
  isConsultant: boolean;
  coachPrimary: boolean;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = displayName ?? userEmail;
  const initial = (name.split(" ")[0]?.[0] ?? name[0] ?? "?").toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:opacity-90"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Your account"
      >
        {/* 30×30 accent-filled circle, Fraunces initial */}
        <span
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] text-white"
          style={{
            background: "var(--t-accent)",
            fontFamily: "var(--font-serif)",
            fontWeight: 600,
          }}
          aria-hidden
        >
          {initial}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-64 py-1"
            style={{
              background: "var(--t-paper)",
              border: "1px solid var(--t-rule)",
              borderRadius: "var(--t-radius-lg)",
              boxShadow: "var(--t-panel-shadow)",
            }}
          >
            <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--t-rule)" }}>
              <div className="text-sm font-medium text-ink">{displayName ?? userEmail}</div>
              <div className="text-xs text-ink-faint">{userEmail}</div>
              {superAdmin && (
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ background: "var(--t-ink)" }}
                >
                  super admin
                </span>
              )}
            </div>
            <DropdownLink href="/profile" onClick={() => setOpen(false)}>
              Your profile
            </DropdownLink>
            {!coachPrimary && (
              <>
                <DropdownLink href="/memory" onClick={() => setOpen(false)}>
                  What your thought partner remembers
                </DropdownLink>
                <DropdownLink href="/pre-session" onClick={() => setOpen(false)}>
                  Pre-session Prep
                </DropdownLink>
              </>
            )}
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
                      Resource Learn
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
            <DropdownDivider />
            {/* Same dropdown-submit gotcha as the mobile drawer:
                setOpen(false) would unmount the form mid-click. Let the
                redirect inside logoutAction unmount everything. */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full px-3.5 py-2 text-left text-sm text-ink-soft hover:text-ink transition"
                style={{ background: "transparent" }}
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

// ─── Dropdown primitives ─────────────────────────────────────────────────
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
      className="block px-3.5 py-2 text-sm text-ink-soft hover:text-ink transition"
      style={{ background: "transparent" }}
    >
      {children}
    </Link>
  );
}

function DropdownDivider() {
  return <div className="my-1" style={{ borderTop: "1px solid var(--t-rule)" }} />;
}

function DropdownSection({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        className="mt-1.5 mb-0.5 pt-1.5"
        style={{ borderTop: "1px solid var(--t-rule)" }}
      />
      <div className="px-3.5 pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        {children}
      </div>
    </>
  );
}

// ─── Mobile primitives ───────────────────────────────────────────────────
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
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
        accent ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
      )}
    >
      {accent && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--t-accent)" }}
        />
      )}
      {children}
    </Link>
  );
}

function MobileSection({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mt-3 mb-0.5 pt-2" style={{ borderTop: "1px solid var(--t-rule)" }} />
      <div className="px-3 pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        {children}
      </div>
    </>
  );
}
