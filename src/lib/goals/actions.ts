"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

const statusSchema = z.enum(["not_started", "in_progress", "completed", "archived"]);

export async function updateGoalStatus(goalId: string, status: string) {
  const parsedId = idSchema.safeParse(goalId);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { error: "invalid input" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data);
  if (error) return { error: error.message };
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveGoal(goalId: string) {
  return updateGoalStatus(goalId, "archived");
}

const startSprintSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  practice: z.string().trim().min(1).max(500),
  plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function startGoalSprint(input: unknown) {
  const parsed = startSprintSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "no active membership" };

  // Ensure the goal belongs to the learner.
  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("id", parsed.data.goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!goal) return { error: "goal not found" };

  const today = new Date().toISOString().slice(0, 10);

  // Close any active sprint for an atomic transition.
  await supabase
    .from("goal_sprints")
    .update({ status: "completed", actual_end_date: today })
    .eq("goal_id", parsed.data.goalId)
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: latest } = await supabase
    .from("goal_sprints")
    .select("sprint_number")
    .eq("goal_id", parsed.data.goalId)
    .order("sprint_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (latest?.sprint_number ?? 0) + 1;

  const { error } = await supabase.from("goal_sprints").insert({
    org_id: membership.org_id,
    user_id: user.id,
    goal_id: parsed.data.goalId,
    title: parsed.data.title,
    practice: parsed.data.practice,
    planned_end_date: parsed.data.plannedEndDate,
    sprint_number: nextNumber,
    status: "active",
  });
  if (error) return { error: error.message };

  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/goals");
  return { ok: true };
}

export async function endGoalSprint(sprintId: string) {
  const parsed = idSchema.safeParse(sprintId);
  if (!parsed.success) return { error: "invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("goal_sprints")
    .update({ status: "completed", actual_end_date: today })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("goal_id")
    .maybeSingle();
  if (error) return { error: error.message };

  if (data?.goal_id) revalidatePath(`/goals/${data.goal_id}`);
  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteGoal(goalId: string) {
  const parsed = idSchema.safeParse(goalId);
  if (!parsed.success) return { error: "invalid id" };
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect("/goals");
}

const createActionLogSchema = z.object({
  description: z.string().min(1).max(5000),
  goalId: z.string().uuid().optional(),
  reflection: z.string().max(5000).optional(),
  impactArea: z.enum(["self", "others", "org", "all"]).optional(),
  occurredOn: z.string().optional(), // YYYY-MM-DD
});

export type CreateActionLogState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

export async function createActionLog(
  _prev: CreateActionLogState,
  formData: FormData,
): Promise<CreateActionLogState> {
  const parsed = createActionLogSchema.safeParse({
    description: formData.get("description"),
    goalId: formData.get("goalId") || undefined,
    reflection: formData.get("reflection") || undefined,
    impactArea: formData.get("impactArea") || undefined,
    occurredOn: formData.get("occurredOn") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "not signed in" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { status: "error", message: "no active membership" };

  // Stamp the goal's active sprint so action_count renders meaningful
  // progress against it. Unattached actions stay sprint-less.
  let sprintId: string | null = null;
  if (parsed.data.goalId) {
    const { data: sprint } = await supabase
      .from("goal_sprints")
      .select("id")
      .eq("goal_id", parsed.data.goalId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    sprintId = sprint?.id ?? null;
  }

  const { error } = await supabase.from("action_logs").insert({
    user_id: user.id,
    org_id: membership.org_id,
    goal_id: parsed.data.goalId ?? null,
    sprint_id: sprintId,
    description: parsed.data.description,
    reflection: parsed.data.reflection ?? null,
    impact_area: parsed.data.impactArea ?? null,
    occurred_on: parsed.data.occurredOn ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/action-log");
  revalidatePath("/dashboard");
  if (parsed.data.goalId) revalidatePath(`/goals/${parsed.data.goalId}`);
  return { status: "success", message: "Action logged." };
}
