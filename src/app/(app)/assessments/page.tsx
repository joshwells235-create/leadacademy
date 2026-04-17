import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssessmentUploader } from "./assessment-uploader";

const TYPES: { key: "pi" | "eqi" | "threesixty"; label: string; description: string }[] = [
  { key: "pi", label: "Predictive Index (PI)", description: "Behavioral and cognitive assessment." },
  { key: "eqi", label: "EQ-i 2.0", description: "Emotional intelligence assessment." },
  { key: "threesixty", label: "360-Degree Feedback", description: "Multi-rater feedback from peers, reports, and managers." },
];

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, ai_summary")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: docs } = assessment
    ? await supabase
        .from("assessment_documents")
        .select("id, type, file_name, status, error_message, ai_summary, uploaded_at")
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
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Upload your PI, EQ-i, and 360 reports. The coach will extract key findings and use them
            to ground your coaching conversations.
          </p>
        </div>
        {readyCount > 0 && (
          <Link
            href="/coach-chat?mode=assessment"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Debrief with coach
          </Link>
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

              {doc?.status === "ready" && doc.ai_summary && typeof doc.ai_summary === "object" ? (
                <AssessmentSummary summary={doc.ai_summary as Record<string, unknown>} />
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
            {readyCount === 1 ? "1 assessment" : `${readyCount} assessments`} processed. The coach
            can walk you through the key findings and help you connect them to your goals.
          </p>
          <Link
            href="/coach-chat?mode=assessment"
            className="mt-3 inline-flex rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Start assessment debrief
          </Link>
        </div>
      )}
    </div>
  );
}

function AssessmentSummary({ summary }: { summary: Record<string, unknown> }) {
  const s = summary as {
    summary?: string;
    key_strengths?: string[];
    growth_areas?: string[];
    coaching_implications?: string;
  };

  return (
    <div className="mt-4 space-y-3 text-sm">
      {s.summary && <p className="text-neutral-800">{s.summary}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {s.key_strengths && s.key_strengths.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Key strengths
            </h3>
            <ul className="mt-1 space-y-0.5 text-neutral-700">
              {s.key_strengths.map((str, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-emerald-500">+</span> {str}
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.growth_areas && s.growth_areas.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Growth areas
            </h3>
            <ul className="mt-1 space-y-0.5 text-neutral-700">
              {s.growth_areas.map((area, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-amber-500">~</span> {area}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {s.coaching_implications && (
        <div className="rounded border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-700">
          <span className="font-medium text-neutral-500">Coaching implication:</span>{" "}
          {s.coaching_implications}
        </div>
      )}
    </div>
  );
}
