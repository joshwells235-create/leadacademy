"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import {
  FormField,
  TextInput,
  SubmitButton,
  FormError,
} from "@/components/ui/form-field";

const initialState: ActionState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Sign in</h2>
        <p className="mt-1 text-sm text-neutral-500">Welcome back.</p>
      </div>

      {state.status === "error" && <FormError message={state.message} />}

      <FormField label="Email" error={state.status === "error" ? state.fieldErrors?.email : undefined}>
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
        <Link href="/forgot-password" className="text-neutral-600 hover:text-brand-blue">
          Forgot password?
        </Link>
        <span className="text-neutral-500">Need an invite? Ask your admin.</span>
      </div>
    </form>
  );
}
