import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const TIERS: { key: "self" | "others" | "org"; label: string; description: string }[] = [
  { key: "self", label: "Leading Self", description: "How you lead yourself — habits, mindset, discipline." },
  { key: "others", label: "Leading Others", description: "How you lead your team and influence peers." },
  { key: "org", label: "Leading the Organization", description: "Vision, strategy, cross-functional impact." },
];

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: goals } = await supabase
    .from("goals")
    .select("id, tier, title, status, target_date, smart_criteria, impact_self, impact_others, impact_org, created_at")
    .eq("user_id", user!.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const byTier: Record<string, NonNullable<typeof goals>> = { self: [], others: [], org: [] };
  for (const g of goals ?? []) {
    if (byTier[g.tier]) byTier[g.tier].push(g);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Growth goals</h1>
        <p className="mt-1 text-sm text-neutral-600">
          SMART goals across three tiers. Click a tier to draft one with the coach, or any existing goal
          to refine it.
        </p>
      </div>

      <div className="space-y-6">
        {TIERS.map((tier) => (
          <section key={tier.key}>
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <h2 className="text-lg font-semibold">{tier.label}</h2>
                <p className="text-sm text-neutral-500">{tier.description}</p>
              </div>
              <Link
                href={`/coach-chat?mode=goal&tier=${tier.key}`}
                className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                + Draft with coach
              </Link>
            </div>
            {byTier[tier.key].length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
                No {tier.label.toLowerCase()} goals yet.{" "}
                <Link
                  href={`/coach-chat?mode=goal&tier=${tier.key}`}
                  className="text-neutral-900 underline"
                >
                  Draft one with the coach
                </Link>
                .
              </div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {byTier[tier.key].map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/goals/${g.id}`}
                      className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-neutral-900">{g.title}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            g.status === "completed"
                              ? "bg-emerald-100 text-emerald-900"
                              : g.status === "in_progress"
                                ? "bg-blue-100 text-blue-900"
                                : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {g.status.replace("_", " ")}
                        </span>
                      </div>
                      {g.target_date && (
                        <p className="mt-1 text-xs text-neutral-500">Target: {g.target_date}</p>
                      )}
                      {g.smart_criteria &&
                        typeof g.smart_criteria === "object" &&
                        "specific" in (g.smart_criteria as object) && (
                          <p className="mt-2 text-sm text-neutral-700">
                            {(g.smart_criteria as { specific?: string }).specific}
                          </p>
                        )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
