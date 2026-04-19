import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Route-boundary auth guard for the consultant portal. Matches the coach
 * and admin layouts so a non-consultant hitting /consultant/* directly
 * gets bounced to their own dashboard instead of seeing a page that
 * quietly returns empty data.
 *
 * Consultants are reachable two ways:
 *   1. An active membership with role = "consultant" in some org, OR
 *   2. They're set as `cohorts.consultant_user_id` on at least one
 *      cohort (the "per-cohort assignment" pattern — a LeadShift
 *      consultant is typically assigned via cohort config, not
 *      via a membership role).
 * Super-admins always pass.
 */
export default async function ConsultantLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: consultantMembership }, { data: consultantCohort }] =
    await Promise.all([
      supabase.from("profiles").select("super_admin").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("role", "consultant")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cohorts")
        .select("id")
        .eq("consultant_user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

  const isConsultant = !!consultantMembership || !!consultantCohort;
  if (!isConsultant && !profile?.super_admin) redirect("/dashboard");

  return <>{children}</>;
}
