import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IntakeCtaButton } from "@/components/intake/intake-cta-button";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile — Leadership Academy" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, role_title, function_area, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, company_size, industry, context_notes, intake_completed_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Your profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your thought partner uses this to ground every conversation. You can edit any of it here,
          or{" "}
          <IntakeCtaButton variant="inline">walk through it conversationally</IntakeCtaButton>.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          What you add here is visible to your human coach — that's what lets them show up
          knowing you. Your back-and-forth chats with the thought partner stay between you and it.
        </p>
      </header>

      <ProfileForm
        initial={{
          role_title: profile?.role_title ?? "",
          function_area: profile?.function_area ?? "",
          team_size: profile?.team_size,
          total_org_influence: profile?.total_org_influence,
          tenure_at_org: profile?.tenure_at_org ?? "",
          tenure_in_leadership: profile?.tenure_in_leadership ?? "",
          company_size: profile?.company_size ?? "",
          industry: profile?.industry ?? "",
          context_notes: profile?.context_notes ?? "",
        }}
        intakeCompleted={!!profile?.intake_completed_at}
      />
    </div>
  );
}
