import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MemoryList } from "@/components/memory/memory-list";
import { ProactivityToggle } from "@/components/memory/proactivity-toggle";
import { listMemoryFacts } from "@/lib/ai/memory/list-facts";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "What your thought partner remembers — Leadership Academy",
};

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
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Memory
        </p>
        <h1
          className="mt-2 leading-[1.08] text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          What your thought partner remembers.
        </h1>
        <p className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-ink-soft">
          Durable things your thought partner has noticed, distilled from
          your conversations. It sees the most recent of these on every turn.
          Edit or delete anything that isn't right — your edits are
          preserved and won't be overwritten.
        </p>
      </div>

      <MemoryList initialFacts={facts} />

      <ProactivityToggle initialEnabled={proactivityEnabled} />
    </div>
  );
}
