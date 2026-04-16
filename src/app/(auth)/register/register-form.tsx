"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type ActionState } from "@/lib/auth/actions";
import {
  FormField,
  TextInput,
  SubmitButton,
  FormError,
  FormSuccess,
} from "@/components/ui/form-field";

const initialState: ActionState = { status: "idle" };

export function RegisterForm({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: string;
}) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Create your account</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Invited as <span className="font-medium">{role}</span>.
        </p>
      </div>

      {state.status === "error" && <FormError message={state.message} />}
      {state.status === "success" && <FormSuccess message={state.message} />}

      <input type="hidden" name="token" value={token} />

      <FormField label="Email">
        <TextInput value={email} disabled readOnly />
      </FormField>

      <FormField
        label="Your name"
        error={state.status === "error" ? state.fieldErrors?.displayName : undefined}
      >
        <TextInput name="displayName" autoComplete="name" required />
      </FormField>

      <FormField
        label="Password"
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

      <SubmitButton pending={pending}>Create account</SubmitButton>

      <div className="text-sm text-neutral-500">
        Already registered?{" "}
        <Link href="/login" className="text-neutral-900 underline">
          Sign in
        </Link>
      </div>
    </form>
  );
}
