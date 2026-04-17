import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/course-content/upload
 * Uploads an image or PDF to the course-content storage bucket.
 * Super-admin only.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.super_admin) return NextResponse.json({ error: "super-admin only" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  const lessonId = formData.get("lessonId") as string | null;

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `courses/${courseId ?? "misc"}/lessons/${lessonId ?? "misc"}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from("course-content").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate a signed URL (1 year expiry for course content).
  const { data: signed } = await supabase.storage.from("course-content").createSignedUrl(path, 365 * 24 * 60 * 60);

  return NextResponse.json({ url: signed?.signedUrl ?? path, path });
}
