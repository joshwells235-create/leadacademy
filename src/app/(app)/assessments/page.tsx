import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { startAssessmentDebrief } from "@/lib/assessments/actions";
import { createClient } from "@/lib/supabase/server";
import { AssessmentUploader } from "./assessment-uploader";
export const metadata: Metadata = { title: "Assessments — Leadership Academy" };

const TYPES: { key: "pi" | "eqi" | "threesixty"; label: string; description: string }[] = [
  { key: "pi", label: "Predictive Index (PI)", description: "Behavioral assessment." },
  { key: "eqi", label: "EQ-i 2.0", description: "Emotional intelligence assessment." },
  {
    key: "threesixty",
    label: "360-Degree Feedback",
    description: "Multi-rater feedback from peers, reports, and managers.",
  },
];

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, ai_summary")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: docs } = assessment
    ? await supabase
        .from("assessment_documents")
        .select("id, type, file_name, status, error_message, uploaded_at")
        .eq("assessment_id", assessment.id)
    : { data: [] };

  const docsByType: Record<string, NonNullable<typeof docs>[number]> = {};
  for (const d of docs ?? []) {
    docsByType[d.type] = d;
  }

  const readyCount = (docs ?? []).filter((d) => d.status === "ready").length;

  // Combined-themes synthesis appears on assessments.ai_summary._combined_themes
  // once ≥2 reports are ready. Surface a chip so the learner knows the
  // integrated view exists before they start the debrief.
  const hasCombinedThemes = !!(
    assessment?.ai_summary &&
    typeof assessment.ai_summary === "object" &&
    !Array.isArray(assessment.ai_summary) &&
    (assessment.ai_summary as Record<string, unknown>)._combined_themes
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            What's been measured
          </p>
          <h1
            className="mt-2 leading-[1.08] text-ink"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            Assessments.
          </h1>
          <p className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-ink-soft">
            Upload PI, EQ-i, and 360 reports. Your thought partner reads
            them, then carries the findings into every conversation — so
            you stop having to re-explain who you are.
          </p>
        </div>
      </div>

      {readyCount > 0 && (
        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 shadow-sm ${
            hasCombinedThemes
              ? "border-brand-navy/20 bg-brand-navy/[0.03]"
              : "border-brand-blue/30 bg-brand-blue/5"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-brand-navy">
                {readyCount === 1
                  ? "Your report is ready to debrief"
                  : `${readyCount} reports ready to debrief`}
              </h2>
              {hasCombinedThemes && (
                <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-navy">
                  Combined themes
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-neutral-600">
              {hasCombinedThemes
                ? "Your thought partner has read them side by side and pulled out the threads running across all of them."
                : "Your thought partner will walk you through the key findings and connect them to your goals."}
            </p>
          </div>
          <form action={startAssessmentDebrief}>
            <button
              type="submit"
              className="shrink-0 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              Debrief with thought partner →
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {TYPES.map((t) => {
          const doc = docsByType[t.key];
          return (
            <section
              key={t.key}
              className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{t.label}</h2>
                  <p className="mt-0.5 text-xs text-neutral-500">{t.description}</p>
                </div>
                {doc && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                      doc.status === "ready"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : doc.status === "processing"
                          ? "bg-amber-50 text-amber-800 ring-amber-200"
                          : "bg-red-50 text-red-800 ring-red-200"
                    }`}
                  >
                    {doc.status}
                  </span>
                )}
              </div>

              {doc?.status === "ready" ? (
                <p className="mt-3 text-sm text-neutral-600">
                  Your thought partner has the key findings. Use the debrief button at the top when
                  you're ready to walk through them.
                </p>
              ) : doc?.status === "error" ? (
                <div className="mt-3 text-sm text-red-700">
                  Processing failed: {doc.error_message ?? "unknown error"}. Try re-uploading.
                </div>
              ) : null}

              <div className="mt-4">
                <AssessmentUploader type={t.key} existingDoc={doc ?? undefined} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
