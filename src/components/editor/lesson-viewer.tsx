import type { JSONContent } from "@tiptap/react";

/**
 * Server-side renderer for Tiptap JSON lesson content.
 *
 * @tiptap/html pulls in happy-dom at import time; happy-dom on Vercel's
 * serverless runtime has been throwing "Failed to load external
 * stylesheet" just on *import*, 500ing the whole lesson page. To avoid
 * that, this module contains NO top-level Tiptap imports — the heavy
 * generate-HTML + sanitize path is pulled in via dynamic import() only
 * when we have actual substance to render. Empty docs short-circuit to
 * a plain notice, sidestepping happy-dom entirely.
 *
 * Author content is trusted at edit time, but paste-from-web can carry
 * scripts / event handlers / data-URIs, so every render goes through
 * DOMPurify with a Tiptap-friendly allowlist before reaching the DOM.
 */

function isEffectivelyEmpty(content: JSONContent): boolean {
  if (!content || !("content" in content)) return true;
  const inner = content.content;
  if (!Array.isArray(inner) || inner.length === 0) return true;
  const hasSubstance = (node: JSONContent): boolean => {
    if (node.type === "text" && typeof node.text === "string" && node.text.length > 0)
      return true;
    if (node.type && node.type !== "paragraph" && node.type !== "doc") return true;
    const kids = Array.isArray(node.content) ? node.content : [];
    return kids.some(hasSubstance);
  };
  return !inner.some(hasSubstance);
}

async function renderTiptapHtml(content: JSONContent): Promise<string> {
  // Dynamic imports — evaluated only when we reach here (i.e. non-empty
  // content). Happy-dom's side-effects stay out of the module graph
  // until the first page actually needs them.
  const [
    { generateHTML },
    { default: StarterKit },
    { default: Image },
    { default: Link },
    { default: Youtube },
    { Table },
    { TableRow },
    { TableHeader },
    { TableCell },
    { default: DOMPurify },
  ] = await Promise.all([
    import("@tiptap/html"),
    import("@tiptap/starter-kit"),
    import("@tiptap/extension-image"),
    import("@tiptap/extension-link"),
    import("@tiptap/extension-youtube"),
    import("@tiptap/extension-table"),
    import("@tiptap/extension-table-row"),
    import("@tiptap/extension-table-header"),
    import("@tiptap/extension-table-cell"),
    import("isomorphic-dompurify"),
  ]);

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

  return DOMPurify.sanitize(rawHtml, {
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
}

export async function LessonViewer({ content }: { content: JSONContent }) {
  if (!content || Object.keys(content).length === 0 || isEffectivelyEmpty(content)) {
    return <p className="text-sm text-neutral-500 italic">No written content for this lesson.</p>;
  }

  let html: string;
  try {
    html = await renderTiptapHtml(content);
  } catch (e) {
    console.error(
      "[lesson-viewer] generateHTML/sanitize failed:",
      e instanceof Error ? (e.stack ?? e.message) : e,
    );
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Couldn't render this lesson's content.</p>
        <p className="mt-1 text-xs text-amber-800">
          The text is saved — something went wrong rendering it for display.
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
