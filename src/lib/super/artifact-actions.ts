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

async function log(opts: {
  actorId: string;
  orgId: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("activity_logs").insert({
    org_id: opts.orgId,
    user_id: opts.actorId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    details: (opts.details ?? {}) as never,
  });
}

// Delete a learner's goal. Cascades to goal_sprints via FK; action_logs
// with this goal_id have the reference nulled (on delete set null).
export async function superDeleteGoal(goalId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: goal } = await admin
    .from("goals")
    .select("org_id, user_id, title")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) return { error: "Goal not found." };

  const { error } = await admin.from("goals").delete().eq("id", goalId);
  if (error) return { error: error.message };

  await log({
    actorId: ctx.userId,
    orgId: goal.org_id,
    action: "super.artifact.goal_deleted",
    targetType: "goal",
    targetId: goalId,
    details: { learner_user_id: goal.user_id, title: goal.title },
  });

  revalidatePath(`/super/orgs/${goal.org_id}/members/${goal.user_id}`);
  return { ok: true };
}

export async function superDeleteReflection(reflectionId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: reflection } = await admin
    .from("reflections")
    .select("org_id, user_id")
    .eq("id", reflectionId)
    .maybeSingle();
  if (!reflection) return { error: "Reflection not found." };

  const { error } = await admin.from("reflections").delete().eq("id", reflectionId);
  if (error) return { error: error.message };

  await log({
    actorId: ctx.userId,
    orgId: reflection.org_id,
    action: "super.artifact.reflection_deleted",
    targetType: "reflection",
    targetId: reflectionId,
    details: { learner_user_id: reflection.user_id },
  });

  revalidatePath(`/super/orgs/${reflection.org_id}/members/${reflection.user_id}`);
  return { ok: true };
}

export async function superDeleteActionLog(actionLogId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: action } = await admin
    .from("action_logs")
    .select("org_id, user_id")
    .eq("id", actionLogId)
    .maybeSingle();
  if (!action) return { error: "Action log not found." };

  const { error } = await admin.from("action_logs").delete().eq("id", actionLogId);
  if (error) return { error: error.message };

  await log({
    actorId: ctx.userId,
    orgId: action.org_id,
    action: "super.artifact.action_log_deleted",
    targetType: "action_log",
    targetId: actionLogId,
    details: { learner_user_id: action.user_id },
  });

  revalidatePath(`/super/orgs/${action.org_id}/members/${action.user_id}`);
  return { ok: true };
}

export async function superDeleteMemoryFact(factId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: fact } = await admin
    .from("learner_memory")
    .select("org_id, user_id")
    .eq("id", factId)
    .maybeSingle();
  if (!fact) return { error: "Memory fact not found." };

  const { error } = await admin.from("learner_memory").delete().eq("id", factId);
  if (error) return { error: error.message };

  await log({
    actorId: ctx.userId,
    orgId: fact.org_id,
    action: "super.artifact.memory_fact_deleted",
    targetType: "learner_memory",
    targetId: factId,
    details: { learner_user_id: fact.user_id },
  });

  revalidatePath(`/super/orgs/${fact.org_id}/members/${fact.user_id}`);
  return { ok: true };
}

// Delete a single assessment document (PI / EQ-i / 360 report) for a
// learner. Use this when someone accidentally uploaded the wrong PDF —
// the extracted content references the wrong person.
//
// Behavior:
// 1. Remove the assessment_documents row
// 2. Delete the underlying file from Storage
// 3. Rebuild the parent assessments.ai_summary so the rolled-up view
//    no longer references the deleted report
// 4. If this was the last doc, delete the parent assessments row too
//    (so the learner gets a fresh slate when they re-upload)
export async function superDeleteAssessmentDocument(documentId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("assessment_documents")
    .select(
      "id, assessment_id, type, file_name, storage_path, assessments:assessment_id(user_id, org_id)",
    )
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Assessment document not found." };

  const assessmentMeta = doc.assessments as unknown as {
    user_id: string;
    org_id: string;
  } | null;

  // Best-effort storage cleanup — don't block on it.
  if (doc.storage_path) {
    await admin.storage.from("assessments").remove([doc.storage_path]);
  }

  const { error: delDocErr } = await admin
    .from("assessment_documents")
    .delete()
    .eq("id", documentId);
  if (delDocErr) return { error: delDocErr.message };

  // Rebuild parent ai_summary from remaining ready docs.
  const { data: remaining } = await admin
    .from("assessment_documents")
    .select("type, ai_summary, status")
    .eq("assessment_id", doc.assessment_id);

  if (!remaining || remaining.length === 0) {
    // No docs left — nuke the parent row too so the learner gets a
    // clean slate when they re-upload their own reports.
    await admin.from("assessments").delete().eq("id", doc.assessment_id);
  } else {
    const rolledUp: Record<string, unknown> = {};
    for (const d of remaining) {
      if (d.status === "ready") rolledUp[d.type] = d.ai_summary;
    }
    await admin
      .from("assessments")
      // biome-ignore lint/suspicious/noExplicitAny: jsonb roundtrip
      .update({ ai_summary: rolledUp as any })
      .eq("id", doc.assessment_id);
  }

  await log({
    actorId: ctx.userId,
    orgId: assessmentMeta?.org_id ?? null,
    action: "super.artifact.assessment_doc_deleted",
    targetType: "assessment_document",
    targetId: documentId,
    details: {
      learner_user_id: assessmentMeta?.user_id ?? null,
      type: doc.type,
      file_name: doc.file_name,
    },
  });

  if (assessmentMeta?.org_id && assessmentMeta?.user_id) {
    revalidatePath(
      `/super/orgs/${assessmentMeta.org_id}/members/${assessmentMeta.user_id}`,
    );
  }
  return { ok: true };
}

export async function superDeleteConversation(conversationId: string) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { data: convo } = await admin
    .from("ai_conversations")
    .select("org_id, user_id, title")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return { error: "Conversation not found." };

  // ai_messages cascade via FK.
  const { error } = await admin.from("ai_conversations").delete().eq("id", conversationId);
  if (error) return { error: error.message };

  await log({
    actorId: ctx.userId,
    orgId: convo.org_id,
    action: "super.artifact.conversation_deleted",
    targetType: "ai_conversation",
    targetId: conversationId,
    details: { learner_user_id: convo.user_id, title: convo.title },
  });

  revalidatePath(`/super/orgs/${convo.org_id}/members/${convo.user_id}`);
  revalidatePath("/super/conversations");
  return { ok: true };
}
