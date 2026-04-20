import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * LMS Phase C5 — render a certificate to a PDF buffer and cache it in
 * Supabase Storage.
 *
 * `@react-pdf/renderer` pulls in a chunky layout engine; lesson-viewer
 * taught us that heavy renderers should stay off the top-level module
 * graph on serverless. Every Tiptap/react-pdf import here is dynamic.
 *
 * Storage path convention: certificates/{user_id}/{certificate_id}.pdf
 * — matches the RLS policy `(storage.foldername(name))[1] = user_id`
 * so learners can read their own rendered file.
 */

type RenderedCert = { pdfUrl: string };

export async function renderAndCacheCertificate(
  certificateId: string,
): Promise<RenderedCert | { error: string }> {
  const admin = createAdminClient();

  const { data: cert } = await admin
    .from("certificates")
    .select(
      "id, user_id, course_id, path_id, issued_at, expires_at, revoked_at, pdf_url, profiles:user_id(display_name), courses:course_id(title), learning_paths:path_id(name)",
    )
    .eq("id", certificateId)
    .maybeSingle();

  if (!cert) return { error: "Certificate not found." };
  if (cert.revoked_at) return { error: "Certificate has been revoked." };

  // Cache hit — nothing to do.
  if (cert.pdf_url) return { pdfUrl: cert.pdf_url };

  // Resolve display data. PostgREST embeds come through as either a
  // single object or an array depending on the FK shape; normalize.
  const one = <T>(v: T | T[] | null): T | null =>
    v === null ? null : Array.isArray(v) ? (v[0] ?? null) : v;
  const profile = one(cert.profiles as unknown as { display_name: string | null } | null);
  const course = one(cert.courses as unknown as { title: string } | null);
  const path = one(cert.learning_paths as unknown as { name: string } | null);

  const learnerName = profile?.display_name?.trim() || "Leader";
  const kindLabel = cert.course_id ? "Course" : "Learning Path";
  const subjectTitle = cert.course_id
    ? (course?.title ?? "Course")
    : (path?.name ?? "Learning Path");

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

  // Dynamic import — @react-pdf/renderer stays out of the cold-start
  // graph of every page that imports from @/lib/certificates.
  const [{ renderToBuffer }, { CertificateDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./pdf-template"),
  ]);

  // renderToBuffer returns a Node Buffer from the react-pdf tree.
  const buffer = (await renderToBuffer(
    CertificateDocument({
      learnerName,
      kindLabel,
      subjectTitle,
      issuedOn,
      expiresOn,
      certificateId: cert.id,
    }),
  )) as Buffer;

  const objectPath = `${cert.user_id}/${cert.id}.pdf`;
  const { error: uploadErr } = await admin.storage.from("certificates").upload(objectPath, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadErr) return { error: uploadErr.message };

  // Not public — generate a long-lived signed URL cached on the row.
  // One year — re-sign on demand if needed.
  const { data: signed, error: signErr } = await admin.storage
    .from("certificates")
    .createSignedUrl(objectPath, 60 * 60 * 24 * 365);
  if (signErr || !signed) return { error: signErr?.message ?? "Failed to sign URL." };

  await admin.from("certificates").update({ pdf_url: signed.signedUrl }).eq("id", cert.id);
  return { pdfUrl: signed.signedUrl };
}
