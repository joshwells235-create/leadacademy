"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import Youtube from "@tiptap/extension-youtube";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useRef, useState } from "react";

type Props = {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  courseId?: string;
  lessonId?: string;
};

export function LessonEditor({ content, onChange, courseId, lessonId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-4", loading: "lazy" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-brand-blue underline cursor-pointer",
          rel: "noopener noreferrer",
        },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: { class: "rounded-lg w-full aspect-video my-4" },
      }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "course-table" } }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: { class: "bg-brand-light font-semibold text-left px-3 py-2 border" },
      }),
      TableCell.configure({
        HTMLAttributes: { class: "px-3 py-2 border align-top" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading...";
          return "Start writing — use the toolbar above for formatting.";
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-5 py-4 prose-headings:text-brand-navy prose-a:text-brand-blue prose-blockquote:border-brand-blue/30 prose-table:border prose-table:border-collapse",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
      const text = e.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    },
    immediatelyRender: false,
  });

  const addImage = useCallback(
    async (file: File) => {
      if (!editor || !courseId || !lessonId) return;
      if (!file.type.startsWith("image/")) {
        setUploadError(
          "Please pick an image file — PDFs and other docs go in the materials list below.",
        );
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("courseId", courseId);
        formData.append("lessonId", lessonId);
        formData.append("kind", "image");
        const res = await fetch("/api/course-content/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setUploadError(data.error ?? "Image upload failed.");
          return;
        }
        if (data.url) {
          // Prompt for alt text — required for a11y and image sanity.
          const alt = window.prompt(
            "Short description of this image (for screen readers):",
            file.name.replace(/\.[^.]+$/, ""),
          );
          editor
            .chain()
            .focus()
            .setImage({
              src: data.url,
              alt: alt?.trim() || file.name,
              title: alt?.trim() || undefined,
            })
            .run();
        }
      } finally {
        setUploading(false);
      }
    },
    [editor, courseId, lessonId],
  );

  const addVideo = useCallback(() => {
    if (!editor) return;
    const url = window.prompt(
      "Paste a YouTube, Vimeo, or Loom URL to embed inline.\n\n(For the full-width lesson video, use the Video field above the editor.)",
    );
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  const inTable = editor.isActive("table");

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-brand-light px-3 py-2">
        <ToolBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </ToolBtn>
        <Sep />

        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2 (Ctrl+Alt+2)"
        >
          <span className="font-bold">H2</span>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3 (Ctrl+Alt+3)"
        >
          <span className="font-bold text-[10px]">H3</span>
        </ToolBtn>
        <Sep />

        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code (Ctrl+E)"
        >
          <span className="font-mono text-[10px]">{"<>"}</span>
        </ToolBtn>
        <Sep />

        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          • List
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          " Quote
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal divider"
        >
          — Line
        </ToolBtn>
        <Sep />

        <ToolBtn
          onClick={() => fileInputRef.current?.click()}
          title="Upload image"
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "🖼 Image"}
        </ToolBtn>
        <ToolBtn onClick={addVideo} title="Embed YouTube/Vimeo/Loom inline">
          ▶ Video
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("link")}
          onClick={addLink}
          title="Insert or edit link (Ctrl+K)"
        >
          🔗 Link
        </ToolBtn>
        <ToolBtn onClick={insertTable} title="Insert 3x3 table">
          ⊞ Table
        </ToolBtn>
      </div>

      {/* Table controls — only visible when caret is inside a table */}
      {inTable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-600">
          <span className="font-medium">Table:</span>
          <MiniBtn onClick={() => editor.chain().focus().addColumnBefore().run()}>
            + col before
          </MiniBtn>
          <MiniBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + col after
          </MiniBtn>
          <MiniBtn onClick={() => editor.chain().focus().deleteColumn().run()}>− col</MiniBtn>
          <span className="mx-1 text-neutral-300">|</span>
          <MiniBtn onClick={() => editor.chain().focus().addRowBefore().run()}>+ row above</MiniBtn>
          <MiniBtn onClick={() => editor.chain().focus().addRowAfter().run()}>+ row below</MiniBtn>
          <MiniBtn onClick={() => editor.chain().focus().deleteRow().run()}>− row</MiniBtn>
          <span className="mx-1 text-neutral-300">|</span>
          <MiniBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
            toggle header row
          </MiniBtn>
          <MiniBtn onClick={() => editor.chain().focus().deleteTable().run()}>delete table</MiniBtn>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addImage(file);
          e.target.value = "";
        }}
      />

      {uploadError && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {uploadError}
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-1.5 flex items-center justify-between text-[10px] text-neutral-400">
        <span>
          <span className="font-medium">Ctrl+B</span> bold ·{" "}
          <span className="font-medium">Ctrl+I</span> italic ·{" "}
          <span className="font-medium">Ctrl+K</span> link ·{" "}
          <span className="font-medium">Tab</span> next cell (in tables)
        </span>
        <span>
          {wordCount} word{wordCount !== 1 ? "s" : ""}
          {wordCount > 0 ? ` · ~${Math.max(1, Math.ceil(wordCount / 200))} min read` : ""}
        </span>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded px-2 py-1 text-xs font-medium transition whitespace-nowrap ${
        disabled
          ? "text-neutral-300 cursor-not-allowed"
          : active
            ? "bg-brand-blue text-white shadow-sm"
            : "text-neutral-700 hover:bg-white hover:shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-700 hover:bg-brand-light"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-neutral-300" />;
}
