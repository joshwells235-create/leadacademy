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

  // Memory facts + a lightweight context summary. Same pattern as the
  // dashboard memory card — when the `learner_memory` table is empty
  // but the learner has real activity (goals, assessments, reflections,
  // conversations, an active sprint), the MemoryList empty state
  // renders an honest inventory of what the TP already has in context
  // rather than the misleading "Nothing remembered yet" copy.
  const [
    facts,
    profileRes,
    { count: goalsActiveCount },
    assessmentRes,
    { count: reflectionsCount },
    { count: conversationsCount },
    sprintRes,
  ] = await Promise.all([
    listMemoryFacts(supabase, user.id, { limit: 500 }),
    supabase
      .from("profiles")
      .select("proactivity_enabled, intake_completed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["not_started", "in_progress"]),
    supabase
      .from("assessments")
      .select("assessment_documents(status)")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("reflections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("goal_sprints")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const proactivityEnabled = profileRes.data?.proactivity_enabled ?? true;
  const assessmentsIntegrated = (
    (assessmentRes.data?.assessment_documents ?? []) as Array<{ status: string }>
  ).filter((d) => d.status === "ready").length;

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
          your conversations. It reads the most recent of these before
          every reply. Edit or delete anything that isn't right — your
          edits are preserved and won't be overwritten.
        </p>
      </div>

      <MemoryList
        initialFacts={facts}
        contextSummary={{
          goalsActive: goalsActiveCount ?? 0,
          assessmentsIntegrated,
          reflectionsCount: reflectionsCount ?? 0,
          conversationsCount: conversationsCount ?? 0,
          hasActiveSprint: (sprintRes.count ?? 0) > 0,
          profileComplete: !!profileRes.data?.intake_completed_at,
        }}
      />

      <ProactivityToggle initialEnabled={proactivityEnabled} />
    </div>
  );
}
