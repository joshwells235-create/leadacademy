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

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {primary?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary.logo_url} alt={primary.name} className="h-7 w-7 rounded" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded bg-neutral-900 text-xs font-semibold text-white">
              LA
            </div>
          )}
          <Link href="/dashboard" className="text-sm font-semibold">
            {primary?.name ?? "LeadAcademy"}
          </Link>
          {superAdmin && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              super admin
            </span>
          )}
        </div>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-neutral-700 hover:text-neutral-900">
            Dashboard
          </Link>
          {superAdmin && (
            <Link href="/super/orgs" className="text-neutral-700 hover:text-neutral-900">
              Orgs
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <div className="font-medium text-neutral-900">{displayName ?? userEmail}</div>
            <div className="text-xs text-neutral-500">
              {memberships[0]?.role ?? (superAdmin ? "super_admin" : "no org")}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
