import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ConversationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select(
      "id, mode, title, last_message_at, user_id, org_id, profiles:user_id(display_name), organizations:org_id(name)",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">AI Conversations</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Review what the AI thought partner is telling learners. Quality control for your core
        product.
      </p>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2 font-medium">Learner</th>
              <th className="text-left px-3 py-2 font-medium">Org</th>
              <th className="text-left px-3 py-2 font-medium">Mode</th>
              <th className="text-left px-3 py-2 font-medium">Last Active</th>
              <th className="text-right px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(conversations ?? []).map((c) => (
              <tr key={c.id} className="border-b border-neutral-50 hover:bg-brand-light transition">
                <td className="px-4 py-3 font-medium text-brand-navy">
                  {(c.profiles as unknown as { display_name: string | null })?.display_name ??
                    "Unknown"}
                </td>
                <td className="px-3 py-3 text-neutral-600">
                  {(c.organizations as unknown as { name: string })?.name ?? ""}
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-xs text-brand-blue">
                    {c.mode}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-neutral-500">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/super/conversations/${c.id}`}
                    className="text-xs text-brand-blue hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
