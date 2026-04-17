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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Course Builder</h1>
          <p className="mt-1 text-sm text-neutral-600">Create and manage the LeadShift course catalog.</p>
        </div>
        <CreateCourseButton />
      </div>

      {(!courses || courses.length === 0) ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No courses yet. Click "New course" to create your first one.
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/super/course-builder/${c.id}`} className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-brand-navy">{c.title}</h2>
                    {c.description && <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "published" ? "bg-emerald-100 text-emerald-900" : "bg-neutral-100 text-neutral-700"}`}>
                    {c.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
