"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";

type Props = {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  courseId?: string;
  lessonId?: string;
};

export function LessonEditor({ content, onChange, courseId, lessonId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: "rounded-lg max-w-full my-4" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-brand-blue underline cursor-pointer" } }),
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: "rounded-lg w-full aspect-video my-4" } }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading...";
          return "Start writing — use the toolbar above for formatting, or type / for shortcuts...";
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-5 py-4 prose-headings:text-brand-navy prose-a:text-brand-blue prose-blockquote:border-brand-blue/30",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
      const text = e.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    },
  });

  const addImage = useCallback(async (file: File) => {
    if (!editor || !courseId || !lessonId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", courseId);
      formData.append("lessonId", lessonId);
      const res = await fetch("/api/course-content/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
      }
    } finally {
      setUploading(false);
    }
  }, [editor, courseId, lessonId]);

  const addVideo = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Paste a YouTube or Vimeo URL:");
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

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-brand-light px-3 py-2">
        {/* Undo / Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">↩</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)">↪</ToolBtn>
        <Sep />

        {/* Headings */}
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2 (Ctrl+Alt+2)">
          <span className="font-bold">H2</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3 (Ctrl+Alt+3)">
          <span className="font-bold text-[10px]">H3</span>
        </ToolBtn>
        <Sep />

        {/* Inline formatting */}
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code (Ctrl+E)">
          <span className="font-mono text-[10px]">{'<>'}</span>
        </ToolBtn>
        <Sep />

        {/* Block elements */}
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          • List
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          1. List
        </ToolBtn>
        <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          " Quote
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal divider">
          — Line
        </ToolBtn>
        <Sep />

        {/* Media */}
        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Upload image" disabled={uploading}>
          {uploading ? "Uploading..." : "🖼 Image"}
        </ToolBtn>
        <ToolBtn onClick={addVideo} title="Embed YouTube/Vimeo video">
          ▶ Video
        </ToolBtn>
        <ToolBtn active={editor.isActive("link")} onClick={addLink} title="Insert or edit link (Ctrl+K)">
          🔗 Link
        </ToolBtn>
      </div>

      {/* Hidden file input for image uploads */}
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

      <EditorContent editor={editor} />

      {/* Footer with keyboard hints + word count */}
      <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-1.5 flex items-center justify-between text-[10px] text-neutral-400">
        <span>
          <span className="font-medium">Ctrl+B</span> bold · <span className="font-medium">Ctrl+I</span> italic · <span className="font-medium">Ctrl+K</span> link · <span className="font-medium">Ctrl+Z</span> undo
        </span>
        <span>{wordCount} word{wordCount !== 1 ? "s" : ""}{wordCount > 0 ? ` · ~${Math.max(1, Math.ceil(wordCount / 200))} min read` : ""}</span>
      </div>
    </div>
  );
}

function ToolBtn({ children, active, onClick, title, disabled }: {
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

function Sep() {
  return <div className="mx-1 h-5 w-px bg-neutral-300" />;
}
