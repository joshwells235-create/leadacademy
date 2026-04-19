import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Growth Goals — Leadership Academy" };

const LENS_LABEL: Record<string, string> = {
  self: "Leading Self",
  others: "Leading Others",
  org: "Leading the Organization",
};

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: goals } = await supabase
    .from("goals")
    .select(
      "id, primary_lens, title, status, target_date, smart_criteria, impact_self, impact_others, impact_org, created_at",
    )
    .eq("user_id", user!.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Growth goals</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Every goal here is integrative — it changes you, the people around you, and the work at
            the organizational level. Click any goal to refine it, or start a new one with your
            thought partner.
          </p>
        </div>
        <Link
          href="/coach-chat?mode=goal"
          className="shrink-0 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          + Draft with thought partner
        </Link>
      </div>

      <div className="mb-6 flex gap-2 text-sm">
        <span className="text-neutral-500">Start from a lens:</span>
        <Link
          href="/coach-chat?mode=goal&lens=self"
          className="text-brand-blue underline hover:text-brand-blue"
        >
          Self
        </Link>
        <span className="text-neutral-300">·</span>
        <Link
          href="/coach-chat?mode=goal&lens=others"
          className="text-brand-blue underline hover:text-brand-blue"
        >
          Others
        </Link>
        <span className="text-neutral-300">·</span>
        <Link
          href="/coach-chat?mode=goal&lens=org"
          className="text-brand-blue underline hover:text-brand-blue"
        >
          Organization
        </Link>
      </div>

      {(!goals || goals.length === 0) && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No goals yet.{" "}
          <Link href="/coach-chat?mode=goal" className="text-brand-blue underline">
            Draft your first one with your thought partner
          </Link>
          .
        </div>
      )}

      {goals && goals.length > 0 && (
        <ul className="space-y-3">
          {goals.map((g) => {
            const smart =
              g.smart_criteria && typeof g.smart_criteria === "object"
                ? (g.smart_criteria as Record<string, string>)
                : {};
            return (
              <li key={g.id}>
                <Link
                  href={`/goals/${g.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="font-semibold text-neutral-900">{g.title}</h2>
                      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                        {g.primary_lens && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                            started from {LENS_LABEL[g.primary_lens]}
                          </span>
                        )}
                        {g.target_date && <span>target {g.target_date}</span>}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
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

                  {smart.specific && (
                    <p className="mt-3 text-sm text-neutral-700">{smart.specific}</p>
                  )}

                  <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600 md:grid-cols-3">
                    <div>
                      <div className="font-medium uppercase tracking-wide text-neutral-500">
                        Self
                      </div>
                      <p className="mt-0.5 line-clamp-2">{g.impact_self}</p>
                    </div>
                    <div>
                      <div className="font-medium uppercase tracking-wide text-neutral-500">
                        Others
                      </div>
                      <p className="mt-0.5 line-clamp-2">{g.impact_others}</p>
                    </div>
                    <div>
                      <div className="font-medium uppercase tracking-wide text-neutral-500">
                        Org
                      </div>
                      <p className="mt-0.5 line-clamp-2">{g.impact_org}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
