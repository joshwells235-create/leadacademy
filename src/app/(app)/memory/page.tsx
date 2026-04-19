import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MemoryList } from "@/components/memory/memory-list";
import { ProactivityToggle } from "@/components/memory/proactivity-toggle";
import { listMemoryFacts } from "@/lib/ai/memory/list-facts";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "What your coach remembers — Leadership Academy" };

export default async function MemoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [facts, profileRes] = await Promise.all([
    listMemoryFacts(supabase, user.id, { limit: 500 }),
    supabase.from("profiles").select("proactivity_enabled").eq("user_id", user.id).maybeSingle(),
  ]);

  const proactivityEnabled = profileRes.data?.proactivity_enabled ?? true;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">What your coach remembers</h1>
        <p className="mt-1 text-sm text-neutral-600">
          These are durable things your coach has noticed about you, distilled from your
          conversations over time. The coach sees the most recent of these on every turn. Edit or
          delete anything that isn't right — your edits are preserved and won't be overwritten.
        </p>
      </div>

      <MemoryList initialFacts={facts} />

      <ProactivityToggle initialEnabled={proactivityEnabled} />
    </div>
  );
}
