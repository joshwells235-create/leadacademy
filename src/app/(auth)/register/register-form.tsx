"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  FormError,
  FormField,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/ui/form-field";
import { type ActionState, registerAction } from "@/lib/auth/actions";

const initialState: ActionState = { status: "idle" };

const ROLE_LABEL: Record<string, string> = {
  learner: "Leadership Academy participant",
  coach: "Executive coach",
  consultant: "LeadShift consultant",
  org_admin: "Organization admin",
  super_admin: "LeadShift admin",
};

const MIN_PW_LENGTH = 12;

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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const roleLabel = ROLE_LABEL[role] ?? role;
  const pwLongEnough = password.length >= MIN_PW_LENGTH;
  const pwRemaining = Math.max(0, MIN_PW_LENGTH - password.length);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-navy">Create your account</h2>
        <p className="mt-1 text-sm text-neutral-500">
          You've been invited as <span className="font-medium text-brand-navy">{roleLabel}</span>.
        </p>
      </div>

      {state.status === "error" && <FormError message={state.message} />}
      {state.status === "success" && <FormSuccess message={state.message} />}

      <input type="hidden" name="token" value={token} />

      <FormField
        label="Email"
        hint="Locked to the address on your invite — contact your admin if it's wrong."
      >
        <TextInput value={email} disabled readOnly aria-describedby="email-hint" />
      </FormField>

      <FormField
        label="Your name"
        hint="How you'd like to be addressed in the app."
        error={state.status === "error" ? state.fieldErrors?.displayName : undefined}
      >
        <TextInput name="displayName" autoComplete="name" required />
      </FormField>

      <FormField
        label="Password"
        error={state.status === "error" ? state.fieldErrors?.password : undefined}
      >
        <div className="relative">
          <TextInput
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            minLength={MIN_PW_LENGTH}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 focus:outline-none focus:ring-1 focus:ring-brand-blue"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              pwLongEnough ? "bg-emerald-500" : "bg-neutral-300"
            }`}
            aria-hidden
          />
          <span className={pwLongEnough ? "text-emerald-700" : "text-neutral-500"}>
            {password.length === 0
              ? `At least ${MIN_PW_LENGTH} characters.`
              : pwLongEnough
                ? "Length looks good."
                : `${pwRemaining} more character${pwRemaining === 1 ? "" : "s"} to go.`}
          </span>
        </div>
      </FormField>

      <SubmitButton pending={pending}>Create account</SubmitButton>

      <div className="text-sm text-neutral-500">
        Already registered?{" "}
        <Link href="/login" className="text-brand-blue underline">
          Sign in
        </Link>
      </div>
    </form>
  );
}
