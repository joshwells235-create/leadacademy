import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
              text: `This is a ${TYPE_LABELS[assessmentType]} report for a participant in a leadership development program. Extract the key findings and return a JSON object with these fields:

{
  "summary": "2-3 sentence executive summary of the assessment results",
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

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
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
