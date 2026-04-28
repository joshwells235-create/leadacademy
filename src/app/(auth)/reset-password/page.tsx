"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormError, FormField, SubmitButton, TextInput } from "@/components/ui/form-field";
import { type ActionState, resetPasswordAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

const initialState: ActionState = { status: "idle" };

type SessionStatus =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [session, setSession] = useState<SessionStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function establish() {
      const supabase = createClient();

      // admin.generateLink({ type: "recovery" }) returns tokens via URL hash
      // (#access_token=...&refresh_token=...&type=recovery). Hash never hits
      // the server, so /auth/callback can't exchange anything — we set the
      // session here, which writes cookies the server action will read.
      if (typeof window !== "undefined" && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (cancelled) return;
          if (error) {
            setSession({ kind: "error", message: error.message });
            return;
          }
          // Strip tokens from the address bar so they don't linger in history.
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
          setSession({ kind: "ready" });
          return;
        }
      }

      // Fallback: PKCE flow already exchanged via /auth/callback, session
      // should already be in cookies.
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        setSession({
          kind: "error",
          message: "Your reset link has expired or already been used.",
        });
        return;
      }
      setSession({ kind: "ready" });
    }

    void establish();
    return () => {
      cancelled = true;
    };
  }, []);

  if (session.kind === "loading") {
    return <p className="text-sm text-ink-soft">Verifying your reset link…</p>;
  }

  if (session.kind === "error") {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Reset link
        </p>
        <h2
          className="leading-[1.15] text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400 }}
        >
          We couldn't verify this link.
        </h2>
        <p className="text-sm text-ink-soft">{session.message}</p>
        <p className="text-sm text-ink-soft">
          Reset links can only be used once and expire after a short window.{" "}
          <Link href="/forgot-password" className="text-brand-blue underline">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

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
