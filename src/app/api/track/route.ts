import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Page-view beacon. The client fires a fire-and-forget POST on every
 * navigation; we record { user_id, path } so super admins can follow a
 * user's journey through the site (onboarding support + product
 * analytics). user_id comes from the authenticated session — never the
 * client — and inserts go through the caller's own RLS-scoped client
 * (insert policy: user_id = auth.uid()).
 *
 * Always returns 204 (even on no-op) so the beacon never surfaces an
 * error in the user's console.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });

    const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
    const raw = typeof body?.path === "string" ? body.path : null;
    if (!raw) return new NextResponse(null, { status: 204 });

    // Store pathname only, capped — drop query strings to keep the trail
    // readable and low-cardinality.
    const path = raw.split("?")[0].slice(0, 300);
    if (!path.startsWith("/")) return new NextResponse(null, { status: 204 });

    // page_views isn't in the generated Database types yet — narrow cast.
    await (
      supabase.from("page_views" as never) as unknown as {
        insert: (v: { user_id: string; path: string }) => Promise<unknown>;
      }
    ).insert({ user_id: user.id, path });
  } catch {
    // Never let tracking break anything.
  }
  return new NextResponse(null, { status: 204 });
}
