import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreatePathButton } from "./create-path-button";

export default async function LearningPathsPage() {
  const supabase = await createClient();

  const [pathsRes, orgsRes] = await Promise.all([
    supabase
      .from("learning_paths")
      .select("id, name, description, org_id, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  const orgNameById = new Map((orgsRes.data ?? []).map((o) => [o.id, o.name]));
  const paths = pathsRes.data ?? [];

  // Course count per path for the index list.
  const pathIds = paths.map((p) => p.id);
  const { data: pathCourses } =
    pathIds.length > 0
      ? await supabase.from("learning_path_courses").select("path_id").in("path_id", pathIds)
      : { data: [] };
  const courseCountByPath = new Map<string, number>();
  for (const pc of pathCourses ?? []) {
    courseCountByPath.set(pc.path_id, (courseCountByPath.get(pc.path_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Learning Paths</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Sequence multiple courses into a guided program. Assign a path to a cohort to
            auto-enroll learners in every course it contains.
          </p>
        </div>
        <CreatePathButton orgs={orgsRes.data ?? []} />
      </div>

      {paths.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">No paths yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
            A learning path is an ordered series of courses. Create one when a cohort needs to move
            through several courses in a specific sequence.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {paths.map((p) => {
            const orgName = p.org_id ? orgNameById.get(p.org_id) : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/super/learning-paths/${p.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="font-semibold text-brand-navy">{p.name}</h2>
                      {p.description && (
                        <p className="mt-1 text-sm text-neutral-600 line-clamp-2">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500">
                      {courseCountByPath.get(p.id) ?? 0} course
                      {(courseCountByPath.get(p.id) ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
                    {orgName ? (
                      <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-brand-blue">
                        {orgName}
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                        All orgs (template)
                      </span>
                    )}
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
