import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReflectionForm } from "./reflection-form";
import { DeleteReflectionButton } from "./delete-reflection-button";

export default async function ReflectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reflections } = await supabase
    .from("reflections")
    .select("id, content, ai_insights, themes, reflected_on, created_at")
    .eq("user_id", user!.id)
    .order("reflected_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = reflections ?? [];

  // Group by date.
  const byDate: Record<string, typeof entries> = {};
  for (const r of entries) {
    const d = r.reflected_on;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  }
  const dates = Object.keys(byDate).sort().reverse();

  // Collect all themes for a frequency display.
  const themeCounts: Record<string, number> = {};
  for (const r of entries) {
    for (const t of r.themes ?? []) {
      themeCounts[t] = (themeCounts[t] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Reflection journal</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Write about what happened, what you noticed, what's sitting with you. The coach will
          reflect back patterns and connections to your goals.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <ReflectionForm />

          {dates.length === 0 ? (
            <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
                <span className="text-xl">📝</span>
              </div>
              <h2 className="font-semibold text-brand-navy">No reflections yet</h2>
              <p className="mt-1 text-sm text-neutral-600 max-w-sm mx-auto">
                Write your first one above — even one sentence about what you noticed today counts.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {dates.map((date) => (
                <div key={date}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {formatDate(date)}
                  </h2>
                  <ul className="space-y-3">
                    {byDate[date].map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap text-sm text-neutral-900 flex-1">{r.content}</p>
                          <DeleteReflectionButton id={r.id} />
                        </div>
                        {r.themes && r.themes.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {r.themes.map((t: string) => (
                              <span
                                key={t}
                                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.ai_insights &&
                          typeof r.ai_insights === "object" &&
                          "summary" in (r.ai_insights as object) && (
                            <div className="mt-3 rounded border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-700">
                              <div className="mb-1 font-medium text-neutral-500">Coach's take</div>
                              {(r.ai_insights as { summary?: string }).summary}
                            </div>
                          )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {topThemes.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Recurring themes</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Patterns surfaced by the coach across your reflections.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topThemes.map(([theme, count]) => (
                  <span
                    key={theme}
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-800"
                  >
                    {theme}{" "}
                    <span className="text-neutral-500">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Talk it through</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Want the coach to help you process something?
            </p>
            <Link
              href="/coach-chat"
              className="mt-3 inline-flex rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark"
            >
              Open coach chat
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
