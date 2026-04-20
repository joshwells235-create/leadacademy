import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseAssigner } from "./course-assigner";

type Props = { params: Promise<{ id: string }> };

export default async function AssignCoursesPage({ params }: Props) {
  const { id: orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const [orgRes, cohortsRes, coursesRes, assignmentsRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    supabase.from("cohorts").select("id, name").eq("org_id", orgId),
    supabase.from("courses").select("id, title, status").eq("status", "published").order("order"),
    supabase.from("cohort_courses").select("cohort_id, course_id, available_from, available_until"),
  ]);

  // Pass full assignment rows (incl. schedule) so the assigner can render
  // per-(cohort,course) date pickers.
  type AssignmentRow = {
    cohort_id: string;
    course_id: string;
    available_from: string | null;
    available_until: string | null;
  };
  const assignmentRows = (assignmentsRes.data ?? []) as AssignmentRow[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/super/orgs" className="hover:text-brand-blue">
          Orgs
        </Link>
        <span>/</span>
        <Link href={`/super/orgs/${orgId}`} className="hover:text-brand-blue">
          {orgRes.data?.name ?? "Org"}
        </Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">Assign Courses</span>
      </nav>

      <h1 className="text-2xl font-bold text-brand-navy mb-2">Assign Courses to Cohorts</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Check a course to make it available to a cohort's learners.
      </p>

      <CourseAssigner
        cohorts={cohortsRes.data ?? []}
        courses={coursesRes.data ?? []}
        assignments={assignmentRows}
      />
    </div>
  );
}
