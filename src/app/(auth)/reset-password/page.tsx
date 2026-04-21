"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton, TextInput } from "@/components/ui/form-field";
import { type ActionState, resetPasswordAction } from "@/lib/auth/actions";

const initialState: ActionState = { status: "idle" };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          New password
        </p>
        <h2
          className="mt-2 leading-[1.15] text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400 }}
        >
          Set a new password.
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          You're signed in from the reset link. Choose a new password.
        </p>
      </div>

      {state.status === "error" && <FormError message={state.message} />}

      <FormField
        label="New password"
        hint="At least 12 characters."
        error={state.status === "error" ? state.fieldErrors?.password : undefined}
      >
        <TextInput
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </FormField>

      <SubmitButton pending={pending}>Update password</SubmitButton>
    </form>
  );
}
