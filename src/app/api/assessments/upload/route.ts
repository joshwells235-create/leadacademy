import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 120; // PDF extraction can take a while

const VALID_TYPES = ["pi", "eqi", "threesixty"] as const;
type AssessmentType = (typeof VALID_TYPES)[number];

const TYPE_LABELS: Record<AssessmentType, string> = {
  pi: "Predictive Index",
  eqi: "EQ-i 2.0",
  threesixty: "360-Degree Feedback",
};

const PI_EXTRACTION_GUIDANCE = `This is a Predictive Index (PI) behavioral report. PI describes TENDENCIES and preferences in how someone naturally operates — it is NOT a diagnosis of who they are.

Phrase every strength and growth area as a TENDENCY, not a solid trait:
- WRITE: "Tends toward quick decision-making, may move before fully consulting stakeholders"
- DO NOT WRITE: "Is decisive" or "Lacks patience"
- WRITE: "Shows a preference for driving pace; can feel impatient when the team deliberates"
- DO NOT WRITE: "Impatient" or "Fast-paced"

Use language like "tends toward", "can lean toward", "shows a preference for", "may", "often". Avoid absolutes.

Ignore the cognitive subscore if present — we only care about the behavioral profile for leadership coaching.`;

const EQI_EXTRACTION_GUIDANCE = `This is an EQ-i 2.0 emotional intelligence report. Strengths and growth areas come from direct self-report scores and are appropriate to state as findings rather than softened tendencies.`;

const THREESIXTY_EXTRACTION_GUIDANCE = `This is a 360-degree feedback report. Strengths and growth areas reflect patterns in how OTHERS experience this leader. State them as observed patterns from raters, with enough specificity that the learner can connect them to real behaviors.`;

const EXTRACTION_GUIDANCE: Record<AssessmentType, string> = {
  pi: PI_EXTRACTION_GUIDANCE,
  eqi: EQI_EXTRACTION_GUIDANCE,
  threesixty: THREESIXTY_EXTRACTION_GUIDANCE,
};

/**
 * POST /api/assessments/upload
 * Accepts multipart/form-data with:
 *   - file: PDF file
 *   - type: "pi" | "eqi" | "threesixty"
 *
 * Flow: upload to Storage → extract text via Claude → save structured summary
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "no membership" }, { status: 403 });

  // Parse multipart.
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file || !type || !VALID_TYPES.includes(type as AssessmentType)) {
    return NextResponse.json(
      { error: "file (PDF) and type (pi|eqi|threesixty) are required" },
      { status: 400 },
    );
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (max 20MB)" }, { status: 400 });
  }

  const assessmentType = type as AssessmentType;

  // Ensure the assessments row exists (one per user).
  const { data: assessment } = await supabase
    .from("assessments")
    .upsert({ user_id: user.id, org_id: membership.org_id }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (!assessment) {
    return NextResponse.json({ error: "failed to create assessments row" }, { status: 500 });
  }

  // Upload to Storage: assessments/{userId}/{type}.pdf
  const storagePath = `${user.id}/${assessmentType}.pdf`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("assessments")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    return NextResponse.json({ error: `upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Upsert the document row (processing state).
  const admin = createAdminClient();
  const { data: doc, error: docError } = await admin
    .from("assessment_documents")
    .upsert(
      {
        assessment_id: assessment.id,
        type: assessmentType,
        storage_path: storagePath,
        file_name: file.name,
        status: "processing",
        error_message: null,
      },
      { onConflict: "assessment_id,type" },
    )
    .select("id")
    .single();
  if (docError || !doc) {
    return NextResponse.json({ error: `doc record failed: ${docError?.message}` }, { status: 500 });
  }

  // Extract + summarize with Claude using the PDF directly.
  try {
    const anthropic = new Anthropic();
    const base64Pdf = fileBuffer.toString("base64");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
            },
            {
              type: "text",
              text: `You are extracting findings from a ${TYPE_LABELS[assessmentType]} report for a participant in a leadership development program. The output will be given to an AI coach (not the participant) to ground future coaching conversations.

${EXTRACTION_GUIDANCE[assessmentType]}

Return a JSON object with these fields:

{
  "summary": "2-3 sentence executive summary of what this report shows",
  "key_strengths": ["strength 1", "strength 2", ...],
  "growth_areas": ["area 1", "area 2", ...],
  "notable_scores": [{"label": "Score Name", "value": "score or description"}, ...],
  "coaching_implications": "1-2 sentences about what a leadership coach should focus on based on these results",
  "raw_highlights": "A longer paragraph capturing the most important specific data points, scores, and verbatim findings from the report that a coach would want to reference"
}

Return ONLY valid JSON, no markdown fences.`,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let aiSummary: Record<string, unknown>;
    try {
      aiSummary = JSON.parse(responseText);
    } catch {
      aiSummary = { summary: responseText, parse_error: true };
    }

    // Update the doc with extracted data.
    await admin
      .from("assessment_documents")
      .update({
        extracted_text: (aiSummary.raw_highlights as string) ?? responseText,
        ai_summary: aiSummary as unknown as Json,
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Roll up: rebuild the parent assessments.ai_summary from all ready docs.
    const { data: allDocs } = await admin
      .from("assessment_documents")
      .select("type, ai_summary")
      .eq("assessment_id", assessment.id)
      .eq("status", "ready");

    const rolledUp: Record<string, unknown> = {};
    for (const d of allDocs ?? []) {
      rolledUp[d.type] = d.ai_summary;
    }

    // Synthesize integrated themes when 2+ reports are ready. These help the
    // coach see the person across the reports rather than in isolated silos.
    if ((allDocs ?? []).length >= 2) {
      try {
        const combinedThemes = await synthesizeCombinedThemes(anthropic, rolledUp);
        if (combinedThemes) {
          rolledUp._combined_themes = combinedThemes;
        }
      } catch {
        // Synthesis is best-effort. If it fails, fall through without blocking
        // the upload — per-report summaries are still available.
      }
    }

    await admin
      .from("assessments")
      .update({ ai_summary: rolledUp as unknown as Json })
      .eq("id", assessment.id);

    return NextResponse.json({ id: doc.id, status: "ready", ai_summary: aiSummary });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "extraction failed";
    await admin
      .from("assessment_documents")
      .update({ status: "error", error_message: errMsg })
      .eq("id", doc.id);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

type CombinedThemes = {
  themes: Array<{ theme: string; evidence: string }>;
};

async function synthesizeCombinedThemes(
  anthropic: Anthropic,
  reports: Record<string, unknown>,
): Promise<CombinedThemes | null> {
  const perReport = Object.entries(reports)
    .filter(([key]) => key === "pi" || key === "eqi" || key === "threesixty")
    .map(([key, val]) => {
      const label = TYPE_LABELS[key as AssessmentType];
      const summary = summarizeReportForSynthesis(val);
      return `### ${label}\n${summary}`;
    })
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Below are findings from multiple leadership assessments for the same person. Identify 3-5 INTEGRATED themes that emerge when you read the reports side by side — the things that show up across multiple reports and together tell a coherent story about how this person operates as a leader.

Phrase each theme as a TENDENCY, not a solid trait. Use language like "tends toward", "can lean toward", "may show up as". Avoid absolutes.

Each theme should cite which reports it draws on.

${perReport}

Return ONLY valid JSON with this shape, no markdown fences:

{
  "themes": [
    { "theme": "one-sentence description of the tendency, phrased softly", "evidence": "short explanation of which reports support it and how" }
  ]
}`,
      },
    ],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const parsed = JSON.parse(responseText) as CombinedThemes;
    if (!Array.isArray(parsed.themes) || parsed.themes.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function summarizeReportForSynthesis(report: unknown): string {
  if (!report || typeof report !== "object") return "(empty)";
  const r = report as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.summary === "string") parts.push(`Summary: ${r.summary}`);
  if (Array.isArray(r.key_strengths) && r.key_strengths.length > 0) {
    parts.push(`Key strengths: ${(r.key_strengths as string[]).join("; ")}`);
  }
  if (Array.isArray(r.growth_areas) && r.growth_areas.length > 0) {
    parts.push(`Growth areas: ${(r.growth_areas as string[]).join("; ")}`);
  }
  if (typeof r.coaching_implications === "string") {
    parts.push(`Coaching implications: ${r.coaching_implications}`);
  }
  return parts.join("\n");
}
