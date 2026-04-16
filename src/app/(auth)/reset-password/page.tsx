"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/lib/auth/actions";
import {
  FormField,
  TextInput,
  SubmitButton,
  FormError,
} from "@/components/ui/form-field";

const initialState: ActionState = { status: "idle" };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Set a new password</h2>
        <p className="mt-1 text-sm text-neutral-500">
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
