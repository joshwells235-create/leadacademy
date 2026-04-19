"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  type: "pi" | "eqi" | "threesixty";
  existingDoc?: { id: string; file_name: string; status: string };
};

export function AssessmentUploader({ type, existingDoc }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const res = await fetch("/api/assessments/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Processing…" : existingDoc ? "Replace PDF" : "Upload PDF"}
        </button>
        {existingDoc && <span className="text-xs text-neutral-500">{existingDoc.file_name}</span>}
      </div>

      {uploading && (
        <p className="mt-2 text-xs text-neutral-500">
          Uploading and processing… this may take 30-60 seconds for large reports.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
