import { createClient } from "@/lib/supabase/server";
import { type CourseRow, CoursesList } from "./courses-list";
import { CreateCourseButton } from "./create-course-button";

export default async function CourseBuilderPage() {
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, status, order, created_at")
    .order("order");

  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: modules } =
    courseIds.length > 0
      ? await supabase.from("modules").select("id, course_id").in("course_id", courseIds)
      : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } =
    moduleIds.length > 0
      ? await supabase.from("lessons").select("id, module_id").in("module_id", moduleIds)
      : { data: [] };

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

  const rows: CourseRow[] = (courses ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    createdAt: c.created_at,
    moduleCount: moduleCountByCourse[c.id] ?? 0,
    lessonCount: lessonCountByCourse[c.id] ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Course Builder</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Create and manage the LeadShift course catalog. Courses you publish here become
            available to assign to cohorts.
          </p>
        </div>
        <CreateCourseButton />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light">
            <span className="text-xl">📚</span>
          </div>
          <h2 className="text-lg font-semibold text-brand-navy">Create your first course</h2>
          <p className="mt-2 mx-auto max-w-md text-sm text-neutral-600">
            A course contains modules, and each module contains lessons. Start by clicking "New
            course" above, then build out the structure.
          </p>
          <div className="mt-4 text-xs text-neutral-500">
            <strong>Typical structure:</strong> Course → 3-5 Modules → 2-4 Lessons each
          </div>
        </div>
      ) : (
        <CoursesList rows={rows} />
      )}
    </div>
  );
}
