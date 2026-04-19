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
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const doUpload = async (file: File) => {
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

  // When a replacement is picked, stage it behind a confirm instead of
  // silently overwriting — an accidental drag-and-drop or wrong file pick
  // would otherwise erase a valid report that took minutes to process.
  const handleFilePicked = (file: File) => {
    if (existingDoc) {
      setPendingReplaceFile(file);
    } else {
      doUpload(file);
    }
  };

  const confirmReplace = () => {
    const file = pendingReplaceFile;
    setPendingReplaceFile(null);
    if (file) doUpload(file);
  };

  const cancelReplace = () => {
    setPendingReplaceFile(null);
    if (inputRef.current) inputRef.current.value = "";
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
          if (file) handleFilePicked(file);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !!pendingReplaceFile}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Processing…" : existingDoc ? "Replace PDF" : "Upload PDF"}
        </button>
        {existingDoc && <span className="text-xs text-neutral-500">{existingDoc.file_name}</span>}
      </div>

      {pendingReplaceFile && (
        <div
          role="alertdialog"
          aria-label="Replace existing report"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs"
        >
          <p className="font-semibold text-amber-900">Replace the existing report?</p>
          <p className="mt-1 text-amber-800">
            This will overwrite <span className="font-medium">{existingDoc?.file_name}</span> with{" "}
            <span className="font-medium">{pendingReplaceFile.name}</span> and re-extract the
            findings. The previous report (and anything your thought partner learned from it) will
            be replaced.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirmReplace}
              className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
            >
              Replace it
            </button>
            <button
              type="button"
              onClick={cancelReplace}
              className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-brand-light"
            >
              Keep the existing one
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <p className="mt-2 text-xs text-neutral-500">
          Uploading and processing… this may take 30-60 seconds for large reports.
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-700">
          {error}. If this keeps happening, make sure the PDF is the original report (not a scan)
          and under 10 MB.
        </p>
      )}
    </div>
  );
}
