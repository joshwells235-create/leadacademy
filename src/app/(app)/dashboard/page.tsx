import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, membershipRes, goalsRes, actionsRes, convRes] = await Promise.all([
    supabase.from("profiles").select("display_name, super_admin").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(name), cohorts(name)")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, tier, title, status")
      .eq("user_id", user!.id)
      .neq("status", "archived"),
    supabase
      .from("action_logs")
      .select("id, description, occurred_on")
      .eq("user_id", user!.id)
      .order("occurred_on", { ascending: false })
      .limit(3),
    supabase
      .from("ai_conversations")
      .select("id, mode, last_message_at")
      .eq("user_id", user!.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const membership = membershipRes.data;
  const goals = goalsRes.data ?? [];
  const actions = actionsRes.data ?? [];

  const firstName = profile?.display_name?.split(" ")[0] ?? user!.email?.split("@")[0] ?? "there";
  const goalsByTier = {
    self: goals.filter((g) => g.tier === "self").length,
    others: goals.filter((g) => g.tier === "others").length,
    org: goals.filter((g) => g.tier === "org").length,
  };
  const totalGoals = goals.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {membership ? (
            <>
              You're in <span className="font-medium text-neutral-900">{membership.organizations?.name}</span>
              {membership.cohorts?.name ? <> — {membership.cohorts.name} cohort</> : null} as a{" "}
              <span className="font-medium text-neutral-900">{membership.role}</span>.
            </>
          ) : profile?.super_admin ? (
            "You're a LeadShift super-admin."
          ) : (
            "No active membership yet."
          )}
        </p>
      </div>

      {totalGoals === 0 ? (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Set your first growth goal</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Chat with the coach to draft a SMART goal across one of the three tiers. The coach will save it
            for you when it's ready.
          </p>
          <Link
            href="/coach-chat"
            className="mt-4 inline-flex rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Start coaching session →
          </Link>
        </div>
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Total goals" value={totalGoals} href="/goals" />
          <StatCard label="Leading self" value={goalsByTier.self} href="/goals" />
          <StatCard label="Leading others" value={goalsByTier.others} href="/goals" />
          <StatCard label="Leading org" value={goalsByTier.org} href="/goals" />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Coach</h2>
            <Link href="/coach-chat" className="text-xs text-neutral-600 hover:text-neutral-900">
              Open →
            </Link>
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            {convRes.data
              ? `Last session: ${new Date(convRes.data.last_message_at ?? "").toLocaleDateString()}`
              : "Haven't talked to the coach yet."}{" "}
            Use the coach for any leadership question, or to draft a new goal.
          </p>
          <Link
            href="/coach-chat"
            className="mt-3 inline-flex rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
          >
            Start a session
          </Link>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent actions</h2>
            <Link href="/action-log" className="text-xs text-neutral-600 hover:text-neutral-900">
              Log + view all →
            </Link>
          </div>
          {actions.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">
              No actions logged yet.{" "}
              <Link href="/action-log" className="text-neutral-900 underline">
                Log your first one
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              {actions.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="shrink-0 text-xs text-neutral-500">{a.occurred_on}</span>
                  <span className="truncate">{a.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
    </Link>
  );
}
