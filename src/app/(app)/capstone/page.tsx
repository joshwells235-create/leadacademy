import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCapstoneGate } from "@/lib/capstone/gate";
import { createClient } from "@/lib/supabase/server";
import { CapstoneWorkspace } from "./capstone-workspace";

export const metadata: Metadata = { title: "Capstone — Leadership Academy" };

export default async function CapstonePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gate = await getCapstoneGate(supabase, user.id);

  if (gate.state === "no_membership" || gate.state === "no_cohort") {
    return (
      <LockedState
        title="Capstone builder"
        message="Your cohort isn't set up yet. Once your cohort is configured, the capstone builder will appear here."
      />
    );
  }

  if (gate.state === "not_scheduled") {
    return (
      <LockedState
        title="Capstone builder — coming later in your program"
        message={`Your cohort ${gate.cohortName} doesn't have a capstone date scheduled yet. We'll open this up later in the program, after you've built up enough of your journey to synthesize. Keep logging, reflecting, and running sprints.`}
      />
    );
  }

  if (gate.state === "locked") {
    return (
      <LockedState
        title="Capstone builder — unlocks later"
        message={`Your capstone builder unlocks on ${formatFullDate(gate.unlocksAt)}. Keep showing up between now and then — every goal, sprint, action, and reflection you log is raw material for the story you'll tell.`}
      />
    );
  }

  // Unlocked — load the outline + stats + conversation link.
  const [outlineRes, goalsCountRes, actionsCountRes, reflectionsCountRes] = await Promise.all([
    supabase
      .from("capstone_outlines")
      .select("id, outline, status, shared_at, finalized_at, conversation_id, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("action_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("reflections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const outline = outlineRes.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="rounded-xl bg-gradient-to-br from-brand-navy to-[#1a2a6b] px-6 py-8 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-pink">
          Final Presentation
        </p>
        <h1 className="mt-1 text-3xl font-bold">Capstone Builder</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          Your capstone is the 10-15 minute story you'll tell your stakeholders about who you've
          become as a leader over the last 9 months. Your thought partner will help you synthesize
          your goals, sprints, actions, and reflections into an arc — but the story, and the
          presentation, are yours.
        </p>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Goals tracked" value={goalsCountRes.count ?? 0} emoji="🎯" />
        <StatCard label="Actions logged" value={actionsCountRes.count ?? 0} emoji="📝" />
        <StatCard label="Reflections" value={reflectionsCountRes.count ?? 0} emoji="✨" />
      </section>

      <CapstoneWorkspace outline={outline ?? null} cohortName={gate.cohortName} />
    </div>
  );
}

function LockedState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="rounded-xl border border-neutral-200 bg-white p-10 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-2xl">
          🔒
        </div>
        <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">{message}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-lg">
          {emoji}
        </div>
        <div>
          <div className="text-2xl font-bold text-brand-navy">{value}</div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function formatFullDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
