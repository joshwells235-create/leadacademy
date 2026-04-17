import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateCourseButton } from "./create-course-button";

export default async function CourseBuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: courses } = await supabase.from("courses").select("id, title, description, status, order, created_at").order("order");

  // Get module + lesson counts per course.
  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: modules } = courseIds.length > 0
    ? await supabase.from("modules").select("id, course_id").in("course_id", courseIds)
    : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length > 0
    ? await supabase.from("lessons").select("id, module_id").in("module_id", moduleIds)
    : { data: [] };

  // Build count maps.
  const moduleCountByCourse: Record<string, number> = {};
  const moduleIdToCourse: Record<string, string> = {};
  for (const m of modules ?? []) {
    moduleCountByCourse[m.course_id] = (moduleCountByCourse[m.course_id] ?? 0) + 1;
    moduleIdToCourse[m.id] = m.course_id;
  }
  const lessonCountByCourse: Record<string, number> = {};
  for (const l of lessons ?? []) {
    const cid = moduleIdToCourse[l.module_id];
    if (cid) lessonCountByCourse[cid] = (lessonCountByCourse[cid] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Course Builder</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Create and manage the LeadShift course catalog. Courses you publish here become available
            to assign to cohorts.
          </p>
        </div>
        <CreateCourseButton />
      </div>

      {(!courses || courses.length === 0) ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
            <span className="text-xl">📚</span>
          </div>
          <h2 className="text-lg font-semibold text-brand-navy">Create your first course</h2>
          <p className="mt-2 mx-auto max-w-md text-sm text-neutral-600">
            A course contains modules, and each module contains lessons. Start by clicking
            "New course" above, then build out the structure.
          </p>
          <div className="mt-4 text-xs text-neutral-500">
            <strong>Typical structure:</strong> Course → 3-5 Modules → 2-4 Lessons each
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => {
            const mCount = moduleCountByCourse[c.id] ?? 0;
            const lCount = lessonCountByCourse[c.id] ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/super/course-builder/${c.id}`} className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/30 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold text-brand-navy">{c.title}</h2>
                      {c.description && <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                        <span>{mCount} module{mCount !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{lCount} lesson{lCount !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>Created {new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "published" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                      {c.status}
                    </span>
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
