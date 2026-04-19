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
  const { data: signIn, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: error.message };
  }

  // Soft-deleted users can't proceed even if auth succeeded. Sign them
  // back out and surface a neutral "account disabled" message.
  if (signIn.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("deleted_at")
      .eq("user_id", signIn.user.id)
      .maybeSingle();
    if (profile?.deleted_at) {
      await supabase.auth.signOut();
      return {
        status: "error",
        message: "This account has been deactivated. Contact your administrator.",
      };
    }
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

  // If the Supabase project has email confirmation OFF, signUp produces a
  // confirmed user + session immediately and we can consume the invite inline.
  // If confirmation is ON, getUser() may still surface the user object from
  // the in-memory signUp result even though there's no real session yet — in
  // that case email_confirmed_at is null and calling consume_invitation would
  // fail with "invitation invalid" (the SECURITY DEFINER RPC sees no valid
  // auth.uid()). Gate on email_confirmed_at to avoid that trap: if the user
  // isn't actually confirmed, fall through to the "check your email" message
  // and let /auth/consume handle consumption after they click the email link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email_confirmed_at) {
    const { error: consumeError } = await supabase.rpc("consume_invitation", {
      p_token: parsed.data.token,
    });
    if (consumeError) {
      return {
        status: "error",
        message: `Account created but invite couldn't be consumed: ${consumeError.message}. Try signing in — if the problem persists, ask your admin to resend the invite.`,
      };
    }
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  // Otherwise, Supabase sent a confirmation email. Invitation is consumed
  // later, when they click the email link and land on /auth/consume.
  return {
    status: "success",
    message:
      "Account created. Check your email for a confirmation link — clicking it will sign you in and finish setup. If nothing arrives in a minute, check spam.",
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
