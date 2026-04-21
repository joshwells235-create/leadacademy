import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteEntryButton } from "./delete-entry-button";
import { JournalForm } from "./journal-form";

export const metadata: Metadata = { title: "Coaching journal — Leadership Academy" };

export default async function CoachJournalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entries } = await supabase
    .from("coach_journal_entries")
    .select("id, content, themes, entry_date, created_at")
    .eq("coach_user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = entries ?? [];

  // Group by entry_date.
  const byDate: Record<string, typeof rows> = {};
  for (const r of rows) {
    if (!byDate[r.entry_date]) byDate[r.entry_date] = [];
    byDate[r.entry_date].push(r);
  }
  const dates = Object.keys(byDate).sort().reverse();

  // Theme frequency over the full log.
  const themeCounts: Record<string, number> = {};
  for (const r of rows) {
    for (const t of r.themes ?? []) {
      themeCounts[t] = (themeCounts[t] ?? 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <p className="section-mark text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Private to you
        </p>
        <h1 className="mt-3 text-2xl font-bold text-brand-navy">Coaching journal</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          A place for your own practice — patterns you're noticing across your caseload, style
          choices you're working on, threads to carry into next week. Your Coach Thought Partner
          reads the ten most recent entries so your own voice carries between conversations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <JournalForm />

          {dates.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
              Nothing here yet. The journal fills up as you add notes about your own coaching
              practice — not your coachees, but you.
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
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex-1 whitespace-pre-wrap text-sm text-brand-navy/90">
                            {r.content}
                          </p>
                          <DeleteEntryButton id={r.id} />
                        </div>
                        {r.themes && r.themes.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {r.themes.map((t) => (
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
              <h2 className="text-sm font-semibold text-brand-navy">Recurring themes</h2>
              <p className="mt-1 text-xs text-neutral-500">
                What shows up across your entries.
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
        </aside>
      </div>
    </div>
  );
}

function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
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
