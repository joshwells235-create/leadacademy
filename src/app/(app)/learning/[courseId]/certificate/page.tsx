import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ courseId: string }> };

/**
 * Convenience redirect — resolves `/learning/[courseId]/certificate`
 * to the learner's newest active certificate for that course, or shows
 * an explanatory page when they don't have one yet.
 */
export default async function CourseCertificateShortcut({ params }: Props) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, revoked_at, expires_at, issued_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cert) redirect(`/certificates/${cert.id}`);

  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-brand-navy">
          No certificate yet for "{course?.title ?? "this course"}"
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
          Your certificate is issued automatically the moment you finish every lesson — no manual
          step required. Keep going and check back.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            href={`/learning/${courseId}`}
            className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
          >
            Continue course →
          </Link>
          <Link
            href="/certificates"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-brand-light"
          >
            View all certificates
          </Link>
        </div>
      </div>
    </div>
  );
}
