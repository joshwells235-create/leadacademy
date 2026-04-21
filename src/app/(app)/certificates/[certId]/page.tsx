import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { renderAndCacheCertificate } from "@/lib/certificates/render";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ certId: string }> };

/**
 * Learner-facing certificate detail view. On first render (when
 * `pdf_url` is null on the row), synchronously renders the PDF, caches
 * it to Supabase Storage, and reads the signed URL back. Subsequent
 * renders are a single SELECT.
 *
 * RLS scopes reads to: the learner themselves, their coach, their
 * consultant, and super-admins. Anyone else sees notFound().
 */
export default async function CertificateDetailPage({ params }: Props) {
  const { certId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cert } = await supabase
    .from("certificates")
    .select(
      "id, user_id, course_id, path_id, issued_at, expires_at, revoked_at, pdf_url, profiles:user_id(display_name), courses:course_id(id, title), learning_paths:path_id(id, name)",
    )
    .eq("id", certId)
    .maybeSingle();
  if (!cert) notFound();

  // If the PDF hasn't been rendered yet, render + cache on demand. The
  // route handler for the PDF itself does the same on its side as a
  // belt-and-suspenders, but rendering here means the learner sees the
  // Download button correctly on first visit.
  let pdfUrl = cert.pdf_url;
  if (!pdfUrl && !cert.revoked_at) {
    const res = await renderAndCacheCertificate(cert.id);
    if ("pdfUrl" in res) pdfUrl = res.pdfUrl;
  }

  const one = <T,>(v: T | T[] | null) =>
    v === null ? null : Array.isArray(v) ? (v[0] ?? null) : v;
  const course = one(cert.courses as unknown as { id: string; title: string } | null);
  const path = one(cert.learning_paths as unknown as { id: string; name: string } | null);
  const profile = one(cert.profiles as unknown as { display_name: string | null } | null);
  const subjectTitle = course?.title ?? path?.name ?? "(removed)";
  const kindLabel = cert.course_id ? "Course" : "Learning Path";
  const issuedOn = new Date(cert.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const expiresOn = cert.expires_at
    ? new Date(cert.expires_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const isExpired = cert.expires_at ? new Date(cert.expires_at).getTime() < Date.now() : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/certificates" className="hover:text-brand-blue">
          Certificates
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{subjectTitle}</span>
      </nav>

      {cert.revoked_at && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger-light/60 px-4 py-3">
          <p className="text-sm font-semibold text-danger">
            This certificate has been revoked.
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            Reach out to the LeadShift team if you think this was a mistake.
          </p>
        </div>
      )}

      {isExpired && !cert.revoked_at && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">This certificate has expired.</p>
          <p className="mt-0.5 text-xs text-amber-800">
            Re-complete the {kindLabel.toLowerCase()} to renew it.
          </p>
        </div>
      )}

      {/* The ceremony moment. This page is often the first thing a learner
          opens after finishing months of work; it should feel weightier than
          a dashboard card. Extra whitespace, serif display type on the name,
          metadata quieted to the edges. */}
      <div className="rounded-lg border border-neutral-200 bg-white px-10 py-14 shadow-sm sm:px-16 sm:py-20">
        <div className="text-center">
          <p className="section-mark inline-block text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-navy/60">
            Certificate of Completion
          </p>
        </div>

        <div className="mt-16 text-center">
          <p className="font-serif text-[13px] italic text-brand-navy/55">Presented to</p>
          <p className="mt-4 font-serif text-5xl font-medium tracking-tight text-brand-navy sm:text-6xl">
            {profile?.display_name || "Leader"}
          </p>
          <div className="mx-auto mt-8 h-px w-20 bg-brand-navy/30" />
          <p className="mx-auto mt-8 max-w-md font-serif text-[15px] italic leading-[1.7] text-brand-navy/70">
            for completing the {kindLabel.toLowerCase()}
          </p>
          <p className="mx-auto mt-3 max-w-lg font-serif text-2xl font-medium text-brand-navy">
            {subjectTitle}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-6 text-[10px]">
          <div>
            <p className="uppercase tracking-[0.18em] text-neutral-400">Issued</p>
            <p className="mt-1 text-[13px] text-brand-navy">{issuedOn}</p>
            {expiresOn && (
              <>
                <p className="mt-3 uppercase tracking-[0.18em] text-neutral-400">Expires</p>
                <p className="mt-1 text-[13px] text-brand-navy">{expiresOn}</p>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="uppercase tracking-[0.18em] text-neutral-400">Verification ID</p>
            <p className="mt-1 font-mono text-[10px] text-neutral-500">{cert.id}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {course?.id && (
          <Link
            href={`/learning/${course.id}`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-brand-light"
          >
            Revisit course
          </Link>
        )}
        {pdfUrl ? (
          <a
            href={pdfUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
          >
            Download PDF ↓
          </a>
        ) : (
          <span className="text-xs italic text-neutral-500">PDF rendering…</span>
        )}
      </div>
    </div>
  );
}
