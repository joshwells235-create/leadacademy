"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  FormError,
  FormField,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/ui/form-field";
import { type ActionState, forgotPasswordAction } from "@/lib/auth/actions";

const initialState: ActionState = { status: "idle" };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Reset
        </p>
        <h2
          className="mt-2 leading-[1.15] text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400 }}
        >
          Reset your password.
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          We'll email you a link to set a new one.
        </p>
      </div>

      {state.status === "error" && <FormError message={state.message} />}
      {state.status === "success" && <FormSuccess message={state.message} />}

      <FormField
        label="Email"
        error={state.status === "error" ? state.fieldErrors?.email : undefined}
      >
        <TextInput type="email" name="email" autoComplete="email" required />
      </FormField>

      <SubmitButton pending={pending}>Send reset link</SubmitButton>

      <div className="text-sm">
        <Link href="/login" className="text-ink-soft hover:text-accent transition">
          ← Back to sign in
        </Link>
      </div>
    </form>
  );
}
