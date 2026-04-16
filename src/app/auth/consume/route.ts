import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Called after email confirmation. Expects `?token=INVITE_TOKEN`.
 * The user is already signed in at this point; we run `consume_invitation`
 * via RLS-scoped client and redirect to the dashboard.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Please sign in to complete registration.")}`, request.url),
    );
  }

  const { error } = await supabase.rpc("consume_invitation", { p_token: token });
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
