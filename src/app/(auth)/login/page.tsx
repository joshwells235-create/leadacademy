"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { FormError, FormField, SubmitButton, TextInput } from "@/components/ui/form-field";
import { type ActionState, loginAction } from "@/lib/auth/actions";

const initialState: ActionState = { status: "idle" };

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginForm urlError={null} />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const sp = useSearchParams();
  return <LoginForm urlError={sp.get("error")} />;
}

function LoginForm({ urlError }: { urlError: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  // URL-level errors surface from /auth/callback and /auth/consume when
  // email confirmation or invite consumption fails. Show them alongside
  // form errors so the user never lands here with no context.
  const errorMessage =
    state.status === "error" ? state.message : urlError ? friendlyAuthError(urlError) : null;

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Sign in
        </p>
        <h2
          className="mt-2 leading-[1.15] text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          Welcome back.
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Enter the credentials from your invitation email.
        </p>
      </div>

      {errorMessage && <FormError message={errorMessage} />}

      <FormField
        label="Email"
        error={state.status === "error" ? state.fieldErrors?.email : undefined}
      >
        <TextInput type="email" name="email" autoComplete="email" required />
      </FormField>

      <FormField
        label="Password"
        error={state.status === "error" ? state.fieldErrors?.password : undefined}
      >
        <TextInput type="password" name="password" autoComplete="current-password" required />
      </FormField>

      <SubmitButton pending={pending}>Sign in</SubmitButton>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-ink-soft hover:text-accent transition">
          Forgot password?
        </Link>
        <span className="text-ink-faint">Need an invite? Ask your admin.</span>
      </div>
    </form>
  );
}

function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid") && lower.includes("grant")) {
    return "The link from your email has expired or was already used. Ask your admin to resend your invite, then try again.";
  }
  if (lower.includes("redirect") || lower.includes("allowed") || lower.includes("uri")) {
    return "The confirmation link pointed somewhere we don't recognize. This is a setup issue — reach out to your program admin.";
  }
  if (lower.includes("email") && lower.includes("confirm")) {
    return "Your email needs to be confirmed before signing in. Check your inbox for the confirmation link (and the spam folder).";
  }
  return `Sign-in couldn't complete: ${raw}. If this keeps happening, reach out to your program admin.`;
}
