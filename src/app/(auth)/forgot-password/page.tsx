"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ActionState } from "@/lib/auth/actions";
import {
  FormField,
  TextInput,
  SubmitButton,
  FormError,
  FormSuccess,
} from "@/components/ui/form-field";

const initialState: ActionState = { status: "idle" };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Reset your password</h2>
        <p className="mt-1 text-sm text-neutral-500">
          We'll email you a link to set a new password.
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
        <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
