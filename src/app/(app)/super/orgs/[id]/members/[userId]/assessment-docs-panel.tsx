"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { superDeleteAssessmentDocument } from "@/lib/super/artifact-actions";

type Doc = {
  id: string;
  type: string;
  file_name: string | null;
  status: string;
  uploaded_at: string | null;
  ai_summary_participant_name: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  pi: "Predictive Index",
  eqi: "EQ-i 2.0",
  threesixty: "360-Degree Feedback",
};

/**
 * Super-admin view of a learner's uploaded assessment documents with
 * per-doc delete. Use this when a wrong PDF was uploaded and the
 * extracted content references the wrong person.
 */
export function AssessmentDocsPanel({
  docs,
  learnerName,
}: {
  docs: Doc[];
  learnerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (docs.length === 0) {
    return null;
  }

  const handleDelete = (id: string) => {
    setError(null);
    start(async () => {
      const res = await superDeleteAssessmentDocument(id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-brand-navy">
        Uploaded assessment files
      </h2>
      <p className="mb-3 text-[11px] text-neutral-500">
        Each file's extracted content is what feeds the thought partner. Delete a doc if the
        wrong PDF was uploaded.
      </p>

      <ul className="space-y-2">
        {docs.map((d) => {
          const mismatch =
            !!d.ai_summary_participant_name &&
            !nameRoughlyMatches(d.ai_summary_participant_name, learnerName);
          const isConfirming = confirmingId === d.id;
          return (
            <li
              key={d.id}
              className="rounded-md border border-neutral-100 bg-brand-light/40 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-brand-navy">
                      {TYPE_LABEL[d.type] ?? d.type}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        d.status === "ready"
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                          : d.status === "processing"
                            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                            : "bg-red-50 text-red-800 ring-red-200"
                      }`}
                    >
                      {d.status}
                    </span>
                    {mismatch && (
                      <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-300">
                        Name mismatch
                      </span>
                    )}
                  </div>
                  {d.file_name && (
                    <p className="mt-1 truncate font-mono text-[11px] text-neutral-600">
                      {d.file_name}
                    </p>
                  )}
                  {d.ai_summary_participant_name && (
                    <p
                      className={`mt-0.5 text-[11px] ${
                        mismatch ? "font-medium text-red-700" : "text-neutral-500"
                      }`}
                    >
                      Extracted for: <em>{d.ai_summary_participant_name}</em>
                      {mismatch && (
                        <>
                          {" "}
                          — but this profile is <em>{learnerName}</em>.
                        </>
                      )}
                    </p>
                  )}
                  {d.uploaded_at && (
                    <p className="mt-0.5 text-[10px] text-neutral-400">
                      Uploaded {new Date(d.uploaded_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {!isConfirming && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingId(d.id);
                      setError(null);
                    }}
                    className="shrink-0 text-[11px] text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>

              {isConfirming && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-[12px] font-semibold text-red-900">
                    Delete this report?
                  </p>
                  <p className="mt-1 text-[11px] text-red-800">
                    The file and its extracted content will be removed and the thought
                    partner will no longer reference it. Re-upload from /assessments to
                    replace.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      disabled={pending}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {pending ? "Deleting…" : "Delete it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(null);
                        setError(null);
                      }}
                      disabled={pending}
                      className="text-[11px] text-neutral-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// Loose name comparison — strip whitespace, lowercase, allow partial
// match either direction so "Joe" vs "Joseph Cundall" doesn't false-flag.
function nameRoughlyMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return true; // can't compare → don't flag
  if (na === nb) return true;
  // Compare on first or last token — a common case is "Joe Cundall" vs "Joseph Cundall"
  // where the last name lines up but first doesn't.
  const tokensA = na.split(" ").filter(Boolean);
  const tokensB = nb.split(" ").filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return true;
  const lastA = tokensA[tokensA.length - 1];
  const lastB = tokensB[tokensB.length - 1];
  if (lastA === lastB) return true;
  // Substring match either way (covers nicknames inside full names).
  return na.includes(nb) || nb.includes(na);
}
