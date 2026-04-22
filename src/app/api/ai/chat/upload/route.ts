import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_MIMES,
  type AttachmentSummary,
  classifyUpload,
  MAX_FILE_BYTES,
} from "@/lib/ai/attachments/types";

// Single-file upload endpoint for chat attachments.
//
// Flow: client opens a file picker, POSTs each file here, shows an
// upload chip on success, and includes the returned `id` in the
// subsequent /api/ai/chat request as `attachmentIds`. Files uploaded
// but never referenced by a message are swept later by a cleanup job.
//
// Storage layout: `chat-attachments/{user_id}/{attachment_id}-{filename}`
// — per-user folder prefix matches the RLS policy on storage.objects.
//
// This endpoint does minimal validation (auth, size, type, extract
// text for text/* mimes). Model-side handling (signed URLs for
// images + PDFs, inline text for transcripts) happens in the chat
// route on the next turn.
export const runtime = "nodejs"; // needs file handling
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  // Fetch the learner's active org up front so we can stamp
  // ai_message_attachments.org_id and scope the storage path cleanly.
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership?.org_id) {
    return NextResponse.json(
      { error: "You need an active org membership to upload attachments." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const file = form.get("file");
  const conversationIdRaw = form.get("conversationId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Conversation id is optional — the client may upload before a
  // conversation row has been created (first message of a new thread).
  // In that case we store the attachment with a NULL conversation_id
  // and let the chat route backfill it once the conversation exists.
  // We still require it to be a UUID string if provided.
  const conversationId =
    typeof conversationIdRaw === "string" && conversationIdRaw.trim() !== ""
      ? conversationIdRaw.trim()
      : null;

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `File too large. The cap is ${Math.round(
          MAX_FILE_BYTES / 1024 / 1024,
        )} MB.`,
      },
      { status: 413 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  const classification = classifyUpload(file.type, file.name);
  if ("error" in classification) {
    return NextResponse.json({ error: classification.error }, { status: 415 });
  }

  // If a conversationId was provided, validate it belongs to this
  // user. RLS on ai_conversations already blocks cross-user reads, but
  // we check explicitly so we can return a clean 404 instead of a
  // downstream FK violation.
  if (conversationId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found or not yours." },
        { status: 404 },
      );
    }
  }

  // Insert the attachment row first so we have an id to use in the
  // storage path. Use admin client because our RLS policy requires
  // `user_id = auth.uid()` which works for server-rendered routes
  // but can flake on edge cases; admin client is simpler here and
  // the auth check above is the real gate.
  const admin = createAdminClient();

  const sanitizedName = sanitizeFilename(file.name);
  const attachmentId = crypto.randomUUID();
  const storagePath = `${user.id}/${attachmentId}-${sanitizedName}`;

  // Extract text content for text/* mimes so the chat route can inline
  // it on subsequent turns without re-fetching from storage every time.
  // Images and PDFs stay binary; they stream to Claude via signed URL
  // on each turn.
  let extractedText: string | null = null;
  if (classification.kind === "text") {
    try {
      extractedText = await file.text();
      // Defensive trim — transcripts can contain stray BOMs and null
      // bytes that trip up downstream prompt assembly.
      extractedText = extractedText.replace(/\0/g, "").trim();
      if (extractedText.length === 0) {
        return NextResponse.json(
          { error: "The text file is empty." },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Couldn't read the text file. Try a .txt / .md / .vtt / .srt export." },
        { status: 400 },
      );
    }
  }

  // Upload to Supabase Storage. `upsert: false` so a re-submission
  // doesn't overwrite an earlier file with the same generated id
  // (shouldn't happen — UUID collisions don't — but belt and braces).
  const bytes = await file.arrayBuffer();
  const { error: storageErr } = await admin.storage
    .from("chat-attachments")
    .upload(storagePath, bytes, {
      contentType: classification.normalizedMime,
      upsert: false,
    });
  if (storageErr) {
    return NextResponse.json(
      { error: `Upload failed: ${storageErr.message}` },
      { status: 500 },
    );
  }

  const { data: inserted, error: dbErr } = await admin
    .from("ai_message_attachments")
    .insert({
      id: attachmentId,
      conversation_id: conversationId,
      message_id: null,
      user_id: user.id,
      org_id: membership.org_id,
      storage_path: storagePath,
      filename: file.name,
      mime_type: classification.normalizedMime,
      size_bytes: file.size,
      kind: classification.kind,
      extracted_text: extractedText,
    })
    .select("id, filename, mime_type, size_bytes, kind")
    .single();

  if (dbErr || !inserted) {
    // Best-effort cleanup of the uploaded blob so we don't leak files
    // on a DB error.
    await admin.storage.from("chat-attachments").remove([storagePath]);
    return NextResponse.json(
      { error: dbErr?.message ?? "Couldn't save attachment metadata." },
      { status: 500 },
    );
  }

  const summary: AttachmentSummary = {
    id: inserted.id,
    filename: inserted.filename,
    mimeType: inserted.mime_type,
    sizeBytes: inserted.size_bytes,
    kind: inserted.kind as AttachmentSummary["kind"],
  };
  return NextResponse.json(summary);
}

// Remove path separators + weird characters from the filename so the
// storage path stays predictable. We don't need perfect round-tripping
// — the user sees the original name via `filename` in the DB row.
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

// Not used directly but re-exported for anyone needing to build a
// stricter MIME whitelist at the edge.
export { ALLOWED_MIMES };
