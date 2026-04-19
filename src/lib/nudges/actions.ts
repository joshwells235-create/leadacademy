"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function dismissNudge(nudgeId: string) {
  const parsed = idSchema.safeParse(nudgeId);
  if (!parsed.success) return { error: "bad id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const now = new Date().toISOString();

  const { data: nudge } = await supabase
    .from("coach_nudges")
    .update({ dismissed_at: now })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .is("dismissed_at", null)
    .is("acted_at", null)
    .select("notification_id")
    .maybeSingle();

  if (nudge?.notification_id) {
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", nudge.notification_id)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
