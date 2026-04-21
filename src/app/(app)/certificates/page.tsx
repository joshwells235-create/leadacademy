import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certificates — Leadership Academy" };

/**
 * Learner-facing cross-course + cross-path certificate index. Shows
 * active (non-revoked, non-expired) and archive (expired / revoked)
 * certs separately. Expired certs are still visible so the learner can
 * see their history; revoked ones are suppressed from the archive
 * unless the learner is a super-admin (handled by /super/certificates).
 */

type CertRow = {
  id: string;
  course_id: string | null;
  path_id: string | null;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  pdf_url: string | null;
  courses: { id: string; title: string } | { id: string; title: string }[] | null;
  learning_paths: { id: string; name: string } | { id: string; name: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (v === null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CertificatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("certificates")
    .select(
      "id, course_id, path_id, issued_at, expires_at, revoked_at, pdf_url, courses:course_id(id, title), learning_paths:path_id(id, name)",
    )
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false });

  const certs = (rows ?? []) as unknown as CertRow[];
  const now = Date.now();
  const active: CertRow[] = [];
  const expired: CertRow[] = [];
  for (const c of certs) {
    if (c.expires_at && new Date(c.expires_at).getTime() < now) expired.push(c);
    else active.push(c);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Your certificates</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Issued when you complete a course or learning path. Each certificate has a verification ID
          so you can share it with confidence.
        </p>
      </div>

      {active.length === 0 && expired.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold text-brand-navy">No certificates yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600">
            Finish a course or a learning path to earn your first one. Progress is tracked
            automatically.
          </p>
          <div className="mt-4">
            <Link
              href="/learning"
              className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              Continue learning →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <ul className="space-y-3">
              {active.map((c) => (
                <li key={c.id}>
                  <CertCard cert={c} />
                </li>
              ))}
            </ul>
          )}
          {expired.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Expired
              </h2>
              <ul className="space-y-3">
                {expired.map((c) => (
                  <li key={c.id}>
                    <CertCard cert={c} expired />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CertCard({ cert, expired = false }: { cert: CertRow; expired?: boolean }) {
  const course = one(cert.courses);
  const path = one(cert.learning_paths);
  const subjectTitle = course?.title ?? path?.name ?? "(removed)";
  const kindLabel = cert.course_id ? "Course" : "Learning Path";

  return (
    <div
      className={`rounded-lg border bg-white p-5 shadow-sm ${expired ? "border-neutral-200 opacity-70" : "border-emerald-200"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
            {kindLabel}
          </span>
          <h3 className="mt-0.5 font-semibold text-brand-navy">{subjectTitle}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Issued {formatDate(cert.issued_at)}
            {cert.expires_at && ` · Expires ${formatDate(cert.expires_at)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {expired && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Expired
            </span>
          )}
          <Link
            href={`/certificates/${cert.id}`}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark"
          >
            View + download
          </Link>
        </div>
      </div>
    </div>
  );
}
