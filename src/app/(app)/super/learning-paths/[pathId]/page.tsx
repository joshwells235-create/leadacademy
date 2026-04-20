import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PathEditor } from "./path-editor";

type Props = { params: Promise<{ pathId: string }> };

export default async function LearningPathDetailPage({ params }: Props) {
  const { pathId } = await params;
  const supabase = await createClient();

  const [pathRes, orgsRes, allCoursesRes, pathCoursesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("learning_paths")
      .select("id, name, description, org_id, updated_at")
      .eq("id", pathId)
      .maybeSingle(),
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("courses").select("id, title, status").eq("status", "published").order("title"),
    supabase
      .from("learning_path_courses")
      .select("course_id, order")
      .eq("path_id", pathId)
      .order("order"),
    supabase
      .from("cohort_learning_paths")
      .select("cohort_id, available_from, due_at, cohorts(id, name, org_id, organizations(name))")
      .eq("path_id", pathId),
  ]);

  if (!pathRes.data) notFound();

  // Eligible cohorts: if path is org-scoped, only that org's cohorts.
  const orgFilter = pathRes.data.org_id;
  const cohortQuery = supabase.from("cohorts").select("id, name, org_id, organizations(name)");
  const { data: eligibleCohorts } = orgFilter
    ? await cohortQuery.eq("org_id", orgFilter)
    : await cohortQuery;

  type CohortRow = {
    id: string;
    name: string;
    org_id: string | null;
    organizations: { name: string } | { name: string }[] | null;
  };
  const cohortsForPicker = ((eligibleCohorts ?? []) as CohortRow[]).map((c) => {
    const org = Array.isArray(c.organizations) ? c.organizations[0] : c.organizations;
    return { id: c.id, name: c.name, orgName: org?.name ?? null };
  });

  type AssignmentRow = {
    cohort_id: string;
    available_from: string | null;
    due_at: string | null;
    cohorts: {
      id: string;
      name: string;
      org_id: string | null;
      organizations: { name: string } | { name: string }[] | null;
    } | null;
  };
  const assignments = ((assignmentsRes.data ?? []) as unknown as AssignmentRow[]).map((a) => {
    const org = Array.isArray(a.cohorts?.organizations)
      ? a.cohorts?.organizations?.[0]
      : a.cohorts?.organizations;
    return {
      cohort_id: a.cohort_id,
      cohort_name: a.cohorts?.name ?? "(removed cohort)",
      org_name: org?.name ?? null,
      available_from: a.available_from,
      due_at: a.due_at,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/learning-paths" className="hover:text-brand-blue">
          Learning Paths
        </Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{pathRes.data.name}</span>
      </nav>

      <PathEditor
        path={pathRes.data}
        orgs={orgsRes.data ?? []}
        allCourses={allCoursesRes.data ?? []}
        initialCourseIds={(pathCoursesRes.data ?? []).map((p) => p.course_id)}
        cohortsForPicker={cohortsForPicker}
        assignments={assignments}
      />
    </div>
  );
}
