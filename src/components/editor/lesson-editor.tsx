"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef } from "react";
import type { JSONContent } from "@tiptap/react";

type Props = {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  courseId?: string;
  lessonId?: string;
};

export function LessonEditor({ content, onChange, courseId, lessonId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: "rounded-lg max-w-full" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-brand-blue underline" } }),
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: "rounded-lg w-full aspect-video" } }),
      Placeholder.configure({ placeholder: "Start writing your lesson content..." }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
  });

  const addImage = useCallback(async (file: File) => {
    if (!editor || !courseId || !lessonId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);
    formData.append("lessonId", lessonId);
    const res = await fetch("/api/course-content/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) {
      editor.chain().focus().setImage({ src: data.url }).run();
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
    const url = window.prompt("URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-brand-light px-2 py-1.5">
        <ToolbarGroup>
          <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</ToolBtn>
          <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</ToolBtn>
        </ToolbarGroup>
        <Sep />
        <ToolbarGroup>
          <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><b>B</b></ToolBtn>
          <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><i>I</i></ToolBtn>
        </ToolbarGroup>
        <Sep />
        <ToolbarGroup>
          <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">List</ToolBtn>
          <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1.</ToolBtn>
          <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">"</ToolBtn>
        </ToolbarGroup>
        <Sep />
        <ToolbarGroup>
          <ToolBtn onClick={() => fileInputRef.current?.click()} title="Upload image">Image</ToolBtn>
          <ToolBtn onClick={addVideo} title="Embed video">Video</ToolBtn>
          <ToolBtn onClick={addLink} title="Add link">Link</ToolBtn>
        </ToolbarGroup>
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
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolBtn({ children, active, onClick, title }: { children: React.ReactNode; active?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition ${active ? "bg-brand-blue text-white" : "text-neutral-700 hover:bg-neutral-200"}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-neutral-300" />;
}
