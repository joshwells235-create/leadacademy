import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="space-y-3 text-sm">
        <h2 className="text-lg font-semibold">Registration is invite-only</h2>
        <p className="text-neutral-600">
          You need an invitation link from an administrator. If you have one, open it directly.
        </p>
        <Link href="/login" className="inline-block text-neutral-900 underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  // Verify the token server-side so the form can prefill the email.
  const supabase = await createClient();
  const { data: invites, error } = await supabase.rpc("verify_invitation", {
    p_token: token,
  });

  if (error || !invites || invites.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <h2 className="text-lg font-semibold">This invite link isn't valid</h2>
        <p className="text-neutral-600">
          It may have expired or already been used. Ask your admin to send a new one.
        </p>
        <Link href="/login" className="inline-block text-neutral-900 underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const invite = invites[0];

  // If somehow this user already has a session and registered, send them in.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.email?.toLowerCase() === invite.email.toLowerCase()) {
    redirect(`/auth/consume?token=${encodeURIComponent(token)}`);
  }

  return <RegisterForm token={token} email={invite.email} role={invite.role} />;
}
