import type { Metadata } from "next";
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

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", user!.id)
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Assessments</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Upload your PI, EQ-i, and 360 reports. Your thought partner will extract key findings
            and use them to ground your conversations.
          </p>
        </div>
        {readyCount > 0 && (
          <form action={startAssessmentDebrief}>
            <button
              type="submit"
              className="shrink-0 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              Debrief with thought partner
            </button>
          </form>
        )}
      </div>

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
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      doc.status === "ready"
                        ? "bg-emerald-100 text-emerald-900"
                        : doc.status === "processing"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-red-100 text-red-900"
                    }`}
                  >
                    {doc.status}
                  </span>
                )}
              </div>

              {doc?.status === "ready" ? (
                <p className="mt-3 text-sm text-neutral-600">
                  Ready. Your thought partner has your findings — start the debrief below to walk
                  through them together.
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

      {readyCount > 0 && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Ready to debrief</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {readyCount === 1 ? "1 assessment" : `${readyCount} assessments`} processed. Your
            thought partner can walk you through the key findings and help you connect them to your
            goals.
          </p>
          <form action={startAssessmentDebrief} className="mt-3">
            <button
              type="submit"
              className="inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
            >
              Start assessment debrief
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
