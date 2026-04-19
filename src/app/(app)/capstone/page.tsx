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
        title="Capstone builder — coming later"
        message={`Your cohort ${gate.cohortName} doesn't have a capstone date scheduled yet. The builder opens up later in the program, after you've built enough of a journey to synthesize.`}
        prepHint
      />
    );
  }

  if (gate.state === "locked") {
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(`${gate.unlocksAt}T00:00:00Z`).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
    return (
      <LockedState
        title="Capstone builder — unlocks soon"
        message={`Opens on ${formatFullDate(gate.unlocksAt)} (${
          daysRemaining === 0
            ? "today!"
            : daysRemaining === 1
              ? "tomorrow"
              : `${daysRemaining} days from now`
        }). Between now and then, every goal, sprint, action, and reflection you log becomes raw material for the story you'll tell.`}
        unlockDate={gate.unlocksAt}
        daysRemaining={daysRemaining}
        prepHint
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
        <StatCard label="Goals tracked" value={goalsCountRes.count ?? 0} href="/goals?status=all" />
        <StatCard label="Actions logged" value={actionsCountRes.count ?? 0} href="/action-log" />
        <StatCard label="Reflections" value={reflectionsCountRes.count ?? 0} href="/reflections" />
      </section>

      <CapstoneWorkspace outline={outline ?? null} cohortName={gate.cohortName} />
    </div>
  );
}

function LockedState({
  title,
  message,
  prepHint,
  unlockDate,
  daysRemaining,
}: {
  title: string;
  message: string;
  prepHint?: boolean;
  unlockDate?: string;
  daysRemaining?: number;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-light">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand-navy"
              aria-hidden
            >
              <title>Locked</title>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
            {unlockDate && daysRemaining != null && daysRemaining > 0 && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-pink">
                {daysRemaining} {daysRemaining === 1 ? "day" : "days"} to go
              </p>
            )}
            <p className="mt-2 text-sm text-neutral-600">{message}</p>
          </div>
        </div>

        {prepHint && (
          <div className="mt-6 border-t border-neutral-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Keep building the raw material
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <PrepLink
                href="/goals"
                title="Goals & sprints"
                hint="Each active sprint is a chapter"
              />
              <PrepLink href="/action-log" title="Action log" hint="Small moves become Evidence" />
              <PrepLink
                href="/reflections"
                title="Reflections"
                hint="Patterns become Shift beats"
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-brand-blue">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function PrepLink({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-neutral-200 bg-white p-3 transition hover:border-brand-blue/40 hover:shadow-sm"
    >
      <p className="text-sm font-semibold text-brand-navy">{title} →</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>
    </Link>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-blue/40 hover:shadow-md"
    >
      <div className="text-2xl font-bold text-brand-navy">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </Link>
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
