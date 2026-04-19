"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  // Verify the invitation (anon-callable RPC).
  const { data: invites, error: verifyError } = await supabase.rpc("verify_invitation", {
    p_token: parsed.data.token,
  });
  if (verifyError || !invites || invites.length === 0) {
    return {
      status: "error",
      message: "Invite link is invalid or has expired. Ask your admin for a new one.",
    };
  }
  const invite = invites[0];

  // Sign up with the email from the invite (user doesn't type email — it's bound to the token).
  // After Supabase's confirmation email is clicked, we need two hops: first
  // /auth/callback to exchange the code for a session, then /auth/consume
  // to run consume_invitation with the token. The consume URL is passed as
  // the `next` param — URL-encoded so the inner `?token=` doesn't get
  // flattened into a top-level query string. Historically this was
  // `/onboarding/consume`, a path that doesn't exist; correct path is
  // `/auth/consume`.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const consumePath = `/auth/consume?token=${encodeURIComponent(parsed.data.token)}`;
  const emailRedirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(consumePath)}`;
  const { error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo,
    },
  });
  if (signUpError) {
    return { status: "error", message: signUpError.message };
  }

  // If email confirmation is off, a session exists now and we can consume immediately.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { error: consumeError } = await supabase.rpc("consume_invitation", {
      p_token: parsed.data.token,
    });
    if (consumeError) {
      return {
        status: "error",
        message: `Account created but invite couldn't be consumed: ${consumeError.message}`,
      };
    }
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  // Otherwise, Supabase sent a confirmation email.
  return {
    status: "success",
    message: "Account created. Check your email to verify, then log in.",
  };
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/reset-password`,
  });
  if (error) {
    return { status: "error", message: error.message };
  }
  return {
    status: "success",
    message:
      "If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder) in a minute or two. Nothing arriving? Double-check the email address and try again.",
  };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: error.message };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
