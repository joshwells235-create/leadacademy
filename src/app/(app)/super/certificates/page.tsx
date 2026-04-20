import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SuperCertsTable } from "./super-certs-table";

export default async function SuperCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: "active" | "revoked" | "expired" | "all" }>;
}) {
  const { status = "active" } = await searchParams;
  const supabase = await createClient();

  // Super RLS lets us see everything. No server-side status filter for
  // "expired" since that requires computing against now() — do it in
  // memory below.
  let query = supabase
    .from("certificates")
    .select(
      "id, user_id, course_id, path_id, cohort_id, issued_at, expires_at, revoked_at, pdf_url, profiles:user_id(display_name), courses:course_id(title), learning_paths:path_id(name), cohorts:cohort_id(name)",
    )
    .order("issued_at", { ascending: false })
    .limit(500);
  if (status === "revoked") query = query.not("revoked_at", "is", null);
  if (status === "active" || status === "expired") query = query.is("revoked_at", null);

  const { data: rows } = await query;

  const now = Date.now();
  const filtered = (rows ?? []).filter((r) => {
    if (status === "all" || status === "revoked") return true;
    const expired = r.expires_at ? new Date(r.expires_at).getTime() < now : false;
    return status === "expired" ? expired : !expired;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Certificates</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Every certificate ever issued, across all orgs + cohorts. Revocations are immediate and
          logged; the learner still sees the row but it's clearly marked revoked.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <FilterLink href="/super/certificates?status=active" active={status === "active"}>
          Active
        </FilterLink>
        <FilterLink href="/super/certificates?status=expired" active={status === "expired"}>
          Expired
        </FilterLink>
        <FilterLink href="/super/certificates?status=revoked" active={status === "revoked"}>
          Revoked
        </FilterLink>
        <FilterLink href="/super/certificates?status=all" active={status === "all"}>
          All
        </FilterLink>
      </div>

      <SuperCertsTable
        rows={filtered.map((r) => {
          const profile = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? null;
          const course = (Array.isArray(r.courses) ? r.courses[0] : r.courses) ?? null;
          const path =
            (Array.isArray(r.learning_paths) ? r.learning_paths[0] : r.learning_paths) ?? null;
          const cohort = (Array.isArray(r.cohorts) ? r.cohorts[0] : r.cohorts) ?? null;
          return {
            id: r.id,
            learnerName: (profile as { display_name: string | null } | null)?.display_name ?? "—",
            subject:
              (course as { title: string } | null)?.title ??
              (path as { name: string } | null)?.name ??
              "(removed)",
            kind: r.course_id ? ("course" as const) : ("path" as const),
            cohortName: (cohort as { name: string } | null)?.name ?? null,
            issuedAt: r.issued_at,
            expiresAt: r.expires_at,
            revokedAt: r.revoked_at,
          };
        })}
      />
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 font-medium transition ${
        active ? "bg-brand-navy text-white" : "bg-brand-light text-neutral-700 hover:bg-neutral-200"
      }`}
    >
      {children}
    </Link>
  );
}
