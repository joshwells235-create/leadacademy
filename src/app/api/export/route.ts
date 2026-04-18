import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const QUERIES: Record<string, { table: string; select: string; orgField?: string }> = {
  members: { table: "memberships", select: "user_id, role, status, cohort_id, created_at, profiles:user_id(display_name)", orgField: "org_id" },
  goals: { table: "goals", select: "user_id, title, status, primary_lens, impact_self, impact_others, impact_org, target_date, created_at", orgField: "org_id" },
  action_logs: { table: "action_logs", select: "user_id, description, reflection, impact_area, occurred_on, created_at", orgField: "org_id" },
  reflections: { table: "reflections", select: "user_id, content, themes, reflected_on, created_at", orgField: "org_id" },
  ai_usage: { table: "ai_usage", select: "user_id, day, model, tokens_in, tokens_out, usd_cents, request_count", orgField: "org_id" },
  lesson_progress: { table: "lesson_progress", select: "user_id, lesson_id, completed, completed_at, score" },
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.super_admin) return NextResponse.json({ error: "super admin only" }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const orgId = url.searchParams.get("orgId");

  if (!type || !QUERIES[type]) return NextResponse.json({ error: "invalid type" }, { status: 400 });

  const q = QUERIES[type];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = admin.from(q.table as any).select(q.select);
  if (orgId && q.orgField) query = query.eq(q.orgField, orgId);
  const { data, error } = await query.limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Convert to CSV.
  if (!data || data.length === 0) {
    return new NextResponse("No data", { headers: { "Content-Type": "text/csv" } });
  }

  const flatRows = (data as unknown as Record<string, unknown>[]).map((row) => {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // Flatten nested object (e.g., profiles).
        for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
          flat[`${k}_${nk}`] = String(nv ?? "");
        }
      } else if (Array.isArray(v)) {
        flat[k] = v.join("; ");
      } else {
        flat[k] = String(v ?? "");
      }
    }
    return flat;
  });

  const headers = [...new Set(flatRows.flatMap((r) => Object.keys(r)))];
  const csvLines = [
    headers.join(","),
    ...flatRows.map((row) => headers.map((h) => `"${(row[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];

  return new NextResponse(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
