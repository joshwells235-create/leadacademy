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
export function LessonViewer({ content }: { content: JSONContent }) {
  if (!content || Object.keys(content).length === 0) {
    return <p className="text-sm text-neutral-500 italic">No content yet.</p>;
  }

  const rawHtml = generateHTML(content, [
    StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
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

  const html = DOMPurify.sanitize(rawHtml, {
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

  return (
    <div
      className="prose prose-sm max-w-none prose-headings:text-brand-navy prose-a:text-brand-blue"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML was just sanitized through DOMPurify with a strict allowlist
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
