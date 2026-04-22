import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";
import type { AttachmentKind, AttachmentRecord } from "./types";
import { SIGNED_URL_TTL_SECONDS } from "./types";

// Convert a set of attachment rows into (a) a prefix string of wrapped
// text content to inline at the top of the user's message, and (b) a
// set of AI SDK `parts` to append to the user UIMessage before sending
// to the model.
//
// Text/transcript files get inlined as <attachment>…</attachment>
// blocks so Claude sees them as distinct reference material rather
// than mistaking transcript content for the learner's own words.
//
// Images + PDFs get sent as AI SDK `image` / `file` parts with signed
// URLs — the AI SDK's Anthropic provider forwards these as Claude file
// / image content blocks on the server side.
//
// Returning the parts separately lets the caller merge them into the
// existing UIMessage parts array without clobbering the user's typed
// text.

type SB = SupabaseClient<Database>;

type ModelPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mediaType: string }
  | { type: "file"; data: string; mediaType: string; filename?: string };

export async function buildAttachmentParts(
  supabase: SB,
  attachmentIds: string[],
): Promise<{ prefixText: string; parts: ModelPart[]; records: AttachmentRecord[] }> {
  if (attachmentIds.length === 0) {
    return { prefixText: "", parts: [], records: [] };
  }

  const { data: rows } = await supabase
    .from("ai_message_attachments")
    .select(
      "id, conversation_id, message_id, user_id, org_id, storage_path, filename, mime_type, size_bytes, kind, extracted_text, created_at",
    )
    .in("id", attachmentIds);
  if (!rows || rows.length === 0) {
    return { prefixText: "", parts: [], records: [] };
  }

  // Text attachments → inline. Wrap each in an explicit block so the
  // model treats them as reference material, not as the learner's
  // voice. Include filename + kind so Claude can reference them back
  // ("in the transcript you shared…").
  const textBlocks: string[] = [];
  const parts: ModelPart[] = [];
  const records: AttachmentRecord[] = [];

  // Use admin client for signed URL creation — it bypasses RLS on
  // storage.objects. The URL is short-lived (see SIGNED_URL_TTL_SECONDS)
  // and only returned to the AI provider, not to the learner's browser.
  const admin = createAdminClient();

  for (const row of rows) {
    const record: AttachmentRecord = {
      id: row.id,
      conversationId: row.conversation_id ?? null,
      messageId: row.message_id ?? null,
      userId: row.user_id,
      orgId: row.org_id,
      storagePath: row.storage_path,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      kind: row.kind as AttachmentKind,
      extractedText: row.extracted_text ?? null,
      createdAt: row.created_at,
    };
    records.push(record);

    if (record.kind === "text") {
      const body = record.extractedText ?? "";
      // Cap per-file inline text so a monster transcript doesn't blow
      // past the context window. 80k chars is generous for a 60-min
      // meeting transcript and still leaves room for the learner's
      // other context. If it's longer, trim and note the truncation.
      const MAX_CHARS = 80_000;
      const truncated = body.length > MAX_CHARS;
      const inline = truncated ? body.slice(0, MAX_CHARS) : body;
      textBlocks.push(
        `<attachment filename="${escapeAttr(record.filename)}" kind="text">\n${inline}${
          truncated ? `\n\n[truncated — original was ${body.length.toLocaleString()} characters]` : ""
        }\n</attachment>`,
      );
      continue;
    }

    const { data: signed } = await admin.storage
      .from("chat-attachments")
      .createSignedUrl(record.storagePath, SIGNED_URL_TTL_SECONDS);
    if (!signed?.signedUrl) {
      // Couldn't mint a URL — surface as an inline note so Claude knows
      // the reference exists even if the content is missing. Rare.
      textBlocks.push(
        `<attachment filename="${escapeAttr(record.filename)}" kind="${record.kind}">[could not load contents]</attachment>`,
      );
      continue;
    }

    if (record.kind === "image") {
      parts.push({ type: "image", image: signed.signedUrl, mediaType: record.mimeType });
    } else {
      // PDF
      parts.push({
        type: "file",
        data: signed.signedUrl,
        mediaType: record.mimeType,
        filename: record.filename,
      });
    }
  }

  const prefixText = textBlocks.length > 0 ? `${textBlocks.join("\n\n")}\n\n` : "";
  return { prefixText, parts, records };
}

// Minimal XML-attribute escaping. We're wrapping a filename in an HTML-
// shaped attribute that Claude reads, so we only need the characters
// that could close / confuse the attribute.
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
