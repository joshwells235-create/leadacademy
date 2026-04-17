import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";

type OrgInfo = { id: string; name: string; logo_url: string | null; slug: string } | null;

type Membership = {
  id: string;
  role: string;
  org: OrgInfo;
};

export function TopNav({
  userEmail,
  displayName,
  superAdmin,
  memberships,
}: {
  userEmail: string;
  displayName: string | null;
  superAdmin: boolean;
  memberships: Membership[];
}) {
  const primary = memberships[0]?.org;
  const isCoach = superAdmin || memberships.some((m) => m.role === "coach" || m.role === "org_admin");

  return (
    <header className="bg-brand-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
          {superAdmin && (
            <span className="rounded-full bg-brand-pink px-2 py-0.5 text-xs font-medium text-white">
              super admin
            </span>
          )}
        </div>

        <nav className="flex items-center gap-5 text-sm">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/goals">Goals</NavLink>
          <NavLink href="/action-log">Actions</NavLink>
          <NavLink href="/reflections">Reflections</NavLink>
          <NavLink href="/assessments">Assessments</NavLink>
          <NavLink href="/learning">Learning</NavLink>
          <NavLink href="/pre-session">Pre-session</NavLink>
          <NavLink href="/coach-chat" accent>Coach</NavLink>
          {isCoach && (
            <Link href="/coach/dashboard" className="rounded-md bg-brand-blue/20 px-2.5 py-1 font-medium text-white hover:bg-brand-blue/30 transition">
              Coach Portal
            </Link>
          )}
          {superAdmin && (
            <Link href="/super/course-builder" className="rounded-md bg-brand-pink/20 px-2.5 py-1 font-medium text-white hover:bg-brand-pink/30 transition">
              Course Builder
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <div className="font-medium">{displayName ?? userEmail}</div>
            <div className="text-xs text-white/60">
              {memberships[0]?.role ?? (superAdmin ? "super_admin" : "no org")}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children, accent }: { href: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`transition ${accent ? "text-brand-pink font-medium hover:text-brand-pink/80" : "text-white/75 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}
