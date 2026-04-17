import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import type { JSONContent } from "@tiptap/react";

/**
 * Server-side HTML generation from Tiptap JSON content.
 * No client-side editor loaded — just renders the HTML.
 */
export function LessonViewer({ content }: { content: JSONContent }) {
  if (!content || Object.keys(content).length === 0) {
    return <p className="text-sm text-neutral-500 italic">No content yet.</p>;
  }

  const html = generateHTML(content, [
    StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
    Image.configure({ HTMLAttributes: { class: "rounded-lg max-w-full" } }),
    Link.configure({ HTMLAttributes: { class: "text-brand-blue underline", target: "_blank" } }),
    Youtube.configure({ HTMLAttributes: { class: "rounded-lg w-full aspect-video" } }),
  ]);

  return (
    <div
      className="prose prose-sm max-w-none prose-headings:text-brand-navy prose-a:text-brand-blue"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
