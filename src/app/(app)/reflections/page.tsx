import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteReflectionButton } from "./delete-reflection-button";
import { ReflectionForm } from "./reflection-form";
export const metadata: Metadata = { title: "Reflections — Leadership Academy" };

export default async function ReflectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reflections } = await supabase
    .from("reflections")
    .select("id, content, ai_insights, themes, reflected_on, created_at")
    .eq("user_id", user.id)
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
      <div className="mb-8">
        <p className="section-mark text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Your journal
        </p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-brand-navy">
          Reflections
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-[17px] leading-[1.65] text-brand-navy/80">
          Write about what happened, what you noticed, what's sitting with you. Your thought partner
          will reflect back patterns and connections to your goals.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <ReflectionForm expandedByDefault={dates.length === 0} />

          {dates.length === 0 ? (
            <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-brand-navy">
                Nothing here yet.
              </h2>
              <figure className="mx-auto mt-5 max-w-md">
                <blockquote className="font-serif text-[17px] italic leading-[1.65] text-brand-navy/80">
                  "We do not learn from experience… we learn from reflecting on experience."
                </blockquote>
                <figcaption className="mt-2 text-[11px] uppercase tracking-[0.18em] text-brand-navy/50">
                  — John Dewey
                </figcaption>
              </figure>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-brand-navy/65">
                Start above. If you'd rather think out loud first, your thought partner can help
                you get it on the page.
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
                        className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="prose-editorial flex-1 whitespace-pre-wrap">
                            {r.content}
                          </p>
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
                Patterns surfaced by your thought partner across your reflections.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topThemes.map(([theme, count]) => (
                  <span
                    key={theme}
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-800"
                  >
                    {theme} <span className="text-neutral-500">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Talk it through</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Want your thought partner to help you process something?
            </p>
            <Link
              href="/coach-chat"
              className="mt-3 inline-flex rounded-md bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue-dark"
            >
              Open thought partner
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
