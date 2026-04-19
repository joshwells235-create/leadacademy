import { createClient } from "@/lib/supabase/server";
import { type AiErrorRow, AiErrorsView } from "./errors-view";

export default async function SuperAiErrorsPage() {
  const supabase = await createClient();

  const { data: errors } = await supabase
    .from("ai_errors")
    .select(
      "id, feature, model, org_id, user_id, conversation_id, error_message, error_details, created_at, organizations:org_id(name), profiles:user_id(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows: AiErrorRow[] = (errors ?? []).map((e) => ({
    id: e.id,
    feature: e.feature,
    model: e.model,
    orgId: e.org_id,
    orgName: (e.organizations as unknown as { name: string } | null)?.name ?? null,
    userId: e.user_id,
    userName:
      (e.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
    errorMessage: e.error_message,
    errorDetails:
      e.error_details && typeof e.error_details === "object" && !Array.isArray(e.error_details)
        ? (e.error_details as Record<string, unknown>)
        : null,
    createdAt: e.created_at,
    conversationId: e.conversation_id,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-brand-navy">AI errors</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Failed AI calls, extraction failures, distillation errors, and similar. Any failure from a
          super-admin-instrumented AI path lands here with full stack context.
        </p>
      </div>
      <AiErrorsView rows={rows} />
    </div>
  );
}
