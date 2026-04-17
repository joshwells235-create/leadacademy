import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get the learner's cohort.
  const { data: membership } = await supabase.from("memberships").select("cohort_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();

  // Get courses assigned to their cohort (or all published courses if no cohort / super-admin).
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();

  let courses: { id: string; title: string; description: string | null; status: string }[] = [];

  if (membership?.cohort_id) {
    const { data: assigned } = await supabase
      .from("cohort_courses")
      .select("courses(id, title, description, status)")
      .eq("cohort_id", membership.cohort_id);
    courses = (assigned ?? []).map((a) => a.courses).filter(Boolean) as typeof courses;
  }

  // Super-admins see all published courses for preview.
  if (profile?.super_admin) {
    const { data: all } = await supabase.from("courses").select("id, title, description, status").eq("status", "published").order("order");
    courses = all ?? [];
  }

  // Get lesson progress for progress bars.
  const courseIds = courses.map((c) => c.id);
  let progressMap: Record<string, { total: number; completed: number }> = {};

  if (courseIds.length > 0) {
    const { data: allLessons } = await supabase.from("lessons").select("id, module_id, modules!inner(course_id)").in("modules.course_id", courseIds);
    const { data: myProgress } = await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user!.id).eq("completed", true);
    const completedIds = new Set((myProgress ?? []).map((p) => p.lesson_id));

    for (const l of allLessons ?? []) {
      const cid = (l.modules as unknown as { course_id: string }).course_id;
      if (!progressMap[cid]) progressMap[cid] = { total: 0, completed: 0 };
      progressMap[cid].total++;
      if (completedIds.has(l.id)) progressMap[cid].completed++;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Learning</h1>
        <p className="mt-1 text-sm text-neutral-600">Courses assigned to your cohort. Work through them at your own pace.</p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No courses assigned to your cohort yet. Check back soon.
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => {
            const progress = progressMap[c.id] ?? { total: 0, completed: 0 };
            const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            return (
              <li key={c.id}>
                <Link href={`/learning/${c.id}`} className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold text-brand-navy">{c.title}</h2>
                      {c.description && <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>}
                    </div>
                    <span className="text-sm font-medium text-brand-blue">{pct}%</span>
                  </div>
                  {progress.total > 0 && (
                    <div className="mt-3 h-1.5 rounded-full bg-neutral-200">
                      <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-neutral-500">{progress.completed}/{progress.total} lessons completed</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
