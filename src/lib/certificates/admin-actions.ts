"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireSuperAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) return { error: "Not authorized." };
  return { userId: user.id };
}

async function logActivity(opts: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("activity_logs").insert({
    org_id: null,
    user_id: opts.actorId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    details: (opts.details ?? {}) as never,
  });
}

export async function revokeCertificate(
  certId: string,
  reason?: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("certificates")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: ctx.userId,
    })
    .eq("id", certId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    action: "super.certificate.revoked",
    targetType: "certificate",
    targetId: certId,
    details: { reason: reason ?? null },
  });

  revalidatePath("/super/certificates");
  revalidatePath(`/certificates/${certId}`);
  return { ok: true };
}

export async function restoreCertificate(
  certId: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("certificates")
    .update({ revoked_at: null, revoked_by: null })
    .eq("id", certId);
  if (error) return { error: error.message };

  await logActivity({
    actorId: ctx.userId,
    action: "super.certificate.restored",
    targetType: "certificate",
    targetId: certId,
  });

  revalidatePath("/super/certificates");
  revalidatePath(`/certificates/${certId}`);
  return { ok: true };
}
