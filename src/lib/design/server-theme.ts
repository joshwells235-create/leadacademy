import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME_MODE, isThemeMode, type ThemeMode } from "./tokens";

// Reads the authenticated learner's theme_mode off `profiles`. Returns
// null on unauthenticated requests so the root layout can fall back to
// the default without branching on error shapes. Safe to call from the
// root layout even though not every route requires auth — a null user
// just means "use the default."
export async function getServerThemeMode(): Promise<ThemeMode | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("theme_mode")
      .eq("user_id", user.id)
      .maybeSingle();

    const v = data?.theme_mode;
    return isThemeMode(v) ? v : DEFAULT_THEME_MODE;
  } catch {
    return null;
  }
}
