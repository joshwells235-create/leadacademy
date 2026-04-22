// Shared types + constants for chat attachments. Kept server-safe so
// both the upload route and the chat-assembly path can import without
// pulling in Supabase or Next plumbing.

export type AttachmentKind = "image" | "pdf" | "text";

export type AttachmentRecord = {
  id: string;
  conversationId: string | null;
  messageId: string | null;
  userId: string;
  orgId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  extractedText: string | null;
  createdAt: string;
};

// Public-facing attachment summary returned from the upload endpoint.
// Omits user/org ids so the client receives only what it needs to
// render a chip and send back on the next message.
export type AttachmentSummary = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
};

// Per-file limits. 20 MB per file matches Anthropic's file-part limit
// for images and leaves headroom for PDFs. Per-message cap (3 files)
// is enforced in the composer UI; the server enforces the per-file
// size cap.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 3;

// Allowed MIME types. Transcripts commonly export as plain text, .vtt
// (WebVTT), or .srt (SubRip). We treat all three as `kind: "text"` and
// extract the text content server-side so Claude sees it inline.
const IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"] as const;
const PDF_MIMES = ["application/pdf"] as const;
const TEXT_MIMES = [
  "text/plain",
  "text/markdown",
  "text/vtt",
  "application/x-subrip",
  // Some browsers report these as octet-stream; we also accept based on
  // file extension as a fallback in the upload route.
] as const;

export const ALLOWED_MIMES = [...IMAGE_MIMES, ...PDF_MIMES, ...TEXT_MIMES] as const;

// Extension fallbacks for browsers that report octet-stream. Checked
// only when the MIME is ambiguous.
const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".vtt", ".srt"] as const;

export function classifyUpload(
  mimeType: string,
  filename: string,
): { kind: AttachmentKind; normalizedMime: string } | { error: string } {
  const lowered = mimeType.toLowerCase();
  if ((IMAGE_MIMES as readonly string[]).includes(lowered)) {
    return { kind: "image", normalizedMime: lowered };
  }
  if ((PDF_MIMES as readonly string[]).includes(lowered)) {
    return { kind: "pdf", normalizedMime: lowered };
  }
  if ((TEXT_MIMES as readonly string[]).includes(lowered)) {
    return { kind: "text", normalizedMime: lowered };
  }

  // Extension-based fallback for ambiguous MIME (application/octet-stream,
  // empty, etc.). Specifically handles transcript files exported from
  // meeting recorders that sometimes drop the MIME.
  const lowerName = filename.toLowerCase();
  if (TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return { kind: "text", normalizedMime: "text/plain" };
  }

  return {
    error: `Unsupported file type: ${mimeType || "unknown"}. Accepted: images (PNG, JPG, GIF, WebP), PDFs, and text transcripts (.txt, .md, .vtt, .srt).`,
  };
}

// How long a signed URL is valid for. Claude's turn takes seconds;
// 10 minutes is a large margin that's still short enough to contain
// any accidental sharing of a URL.
export const SIGNED_URL_TTL_SECONDS = 60 * 10;
