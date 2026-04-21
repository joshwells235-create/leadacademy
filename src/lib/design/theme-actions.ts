"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isThemeMode, type ThemeMode } from "./tokens";

// Persists the learner's theme selection. Called from <ModeToggle>
// when the user flips between Editorial and Cinematic. Revalidates "/"
// so the root layout re-renders with the new data-theme attribute on
// the next navigation.
export async function setThemeMode(
  mode: ThemeMode,
): Promise<{ ok: true } | { error: string }> {
  if (!isThemeMode(mode)) return { error: "invalid theme mode" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ theme_mode: mode, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
