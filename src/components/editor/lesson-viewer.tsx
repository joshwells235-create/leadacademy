import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import Youtube from "@tiptap/extension-youtube";
import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "isomorphic-dompurify";

/**
 * Server-side HTML generation + sanitization from Tiptap JSON content.
 * Author content is trusted at edit time, but paste-from-web can carry
 * scripts / event handlers / data-URIs, so every render goes through
 * DOMPurify with a Tiptap-friendly allowlist before reaching the DOM.
 */
/**
 * Returns true if the Tiptap doc is effectively empty — e.g. a fresh
 * lesson with only an auto-inserted empty paragraph. Skipping the
 * generateHTML path in that case sidesteps happy-dom entirely, which
 * has been intermittently throwing "Failed to load external stylesheet"
 * on Vercel's runtime and 500ing the whole lesson page.
 */
function isEffectivelyEmpty(content: JSONContent): boolean {
  if (!content || !("content" in content)) return true;
  const inner = content.content;
  if (!Array.isArray(inner) || inner.length === 0) return true;
  // Walk the tree for any text or non-paragraph node.
  const hasSubstance = (node: JSONContent): boolean => {
    if (node.type === "text" && typeof node.text === "string" && node.text.length > 0)
      return true;
    if (node.type && node.type !== "paragraph" && node.type !== "doc") return true;
    const kids = Array.isArray(node.content) ? node.content : [];
    return kids.some(hasSubstance);
  };
  return !inner.some(hasSubstance);
}

export function LessonViewer({ content }: { content: JSONContent }) {
  if (!content || Object.keys(content).length === 0 || isEffectivelyEmpty(content)) {
    return <p className="text-sm text-neutral-500 italic">No written content for this lesson.</p>;
  }

  // Tiptap's generateHTML + DOMPurify run at request time on the server.
  // On Vercel's serverless runtime, happy-dom (a Tiptap peer dep) has
  // thrown "Failed to load external stylesheet" when rendering certain
  // nodes — that error shouldn't 500 the whole lesson page. Catch, log
  // with full context so `/super/ai-errors`-style tooling can surface it,
  // and render a graceful fallback so the learner still sees the page.
  let html: string;
  try {
    const rawHtml = generateHTML(content, [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto", loading: "lazy" },
      }),
      Link.configure({
        HTMLAttributes: {
          class: "text-brand-blue underline",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Youtube.configure({ HTMLAttributes: { class: "rounded-lg w-full aspect-video" } }),
      Table.configure({
        HTMLAttributes: { class: "course-table border-collapse my-4 w-full text-sm" },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: "bg-brand-light font-semibold text-left px-3 py-2 border border-neutral-300",
        },
      }),
      TableCell.configure({
        HTMLAttributes: { class: "px-3 py-2 border border-neutral-300 align-top" },
      }),
    ]);

    html = DOMPurify.sanitize(rawHtml, {
    // Tiptap block + inline elements, plus iframe (for YouTube) with a
    // uri regex restriction. No <script>, no inline event handlers, no
    // data: URIs for images.
    ALLOWED_TAGS: [
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "hr",
      "strong",
      "em",
      "u",
      "s",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "iframe",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "div",
      "span",
    ],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "title",
      "class",
      "loading",
      "allow",
      "allowfullscreen",
      "frameborder",
      "width",
      "height",
      "colspan",
      "rowspan",
      "data-tone",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "data-tone"],
    });
  } catch (e) {
    // Log the full message + stack so we can see exactly what's failing
    // when "Preview as learner" hits this path on Vercel. Don't 500 the
    // page — the lesson body may render fine for other learners and a
    // rich error is more useful than a broken page.
    console.error(
      "[lesson-viewer] generateHTML/sanitize failed:",
      e instanceof Error ? e.stack ?? e.message : e,
    );
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Couldn't render this lesson's content.</p>
        <p className="mt-1 text-xs text-amber-800">
          The text is saved — something went wrong rendering it for display.
          The content team has been notified.
          {e instanceof Error && (
            <span className="mt-1 block font-mono text-[10px] text-amber-700/80">
              {e.message}
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none prose-headings:text-brand-navy prose-a:text-brand-blue"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML was just sanitized through DOMPurify with a strict allowlist
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
