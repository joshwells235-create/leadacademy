import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/course-content/upload
 * Super-admin-only upload to the course-content storage bucket.
 * Validated against a MIME allowlist + size cap. Returns a long-lived
 * signed URL for embedding in lesson content or materials list.
 */

// 50 MB cap per file. Course materials are meant for PDFs, worksheets,
// short video clips — not massive downloads. Bigger needs should go
// through a dedicated flow.
const MAX_BYTES = 50 * 1024 * 1024;

// Split by use case so the caller can tell what shape of upload this is.
const IMAGE_MIME_ALLOW = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const MATERIAL_MIME_ALLOW = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "text/csv",
  "text/plain",
]);
const ALLOWED_MIME = new Set([...IMAGE_MIME_ALLOW, ...MATERIAL_MIME_ALLOW]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "text/csv": "csv",
  "text/plain": "txt",
};

function safeExtForFile(file: File): string {
  const fromMime = EXT_BY_MIME[file.type];
  if (fromMime) return fromMime;
  // Fall back to name extension, stripped to alphanumeric.
  const raw = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  return raw.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin)
    return NextResponse.json({ error: "super-admin only" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  const lessonId = formData.get("lessonId") as string | null;
  const kind = (formData.get("kind") as string | null) ?? "material";

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large. Max ${Math.round(MAX_BYTES / (1024 * 1024))} MB — this one is ${Math.round(
          file.size / (1024 * 1024),
        )} MB.`,
      },
      { status: 413 },
    );
  }

  const allowlist =
    kind === "image" ? IMAGE_MIME_ALLOW : kind === "material" ? MATERIAL_MIME_ALLOW : ALLOWED_MIME;
  if (!allowlist.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || "unknown"}.` },
      { status: 415 },
    );
  }

  const ext = safeExtForFile(file);
  const path = `courses/${courseId ?? "misc"}/lessons/${lessonId ?? "misc"}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from("course-content").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Long-lived signed URL — course content is semi-public and the URL
  // isn't guessable. Six months matches a typical cohort length; rotate
  // if a sensitive asset leaks.
  const { data: signed } = await supabase.storage
    .from("course-content")
    .createSignedUrl(path, 180 * 24 * 60 * 60);

  return NextResponse.json({
    url: signed?.signedUrl ?? path,
    path,
    contentType: file.type,
    size: file.size,
    name: file.name,
  });
}
