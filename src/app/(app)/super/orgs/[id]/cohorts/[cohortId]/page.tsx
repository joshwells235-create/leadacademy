import Link from "next/link";
import { notFound } from "next/navigation";
import { labelForRole, roleBadgeClass } from "@/lib/admin/roles";
import { createClient } from "@/lib/supabase/server";
import { CohortEditPanel } from "./cohort-edit-panel";

type Props = { params: Promise<{ id: string; cohortId: string }> };

const DAY_14_AGO_ISO = () => new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

export default async function SuperCohortDetailPage({ params }: Props) {
  const { id: orgId, cohortId } = await params;
  const supabase = await createClient();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select(
      "id, org_id, name, description, starts_at, ends_at, capstone_unlocks_at, consultant_user_id, created_at",
    )
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort || cohort.org_id !== orgId) notFound();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  const since14 = DAY_14_AGO_ISO();

  const [membersRes, consultantRes, coursesRes] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, user_id, role, status, consultant_user_id, profiles:user_id(display_name, intake_completed_at)",
      )
      .eq("cohort_id", cohortId),
    cohort.consultant_user_id
      ? supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", cohort.consultant_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cohort_courses")
      .select("course_id, courses:course_id(id, title, status)")
      .eq("cohort_id", cohortId),
  ]);

  type MemberRow = {
    id: string;
    user_id: string;
    role: string;
    status: string;
    consultant_user_id: string | null;
    profiles: { display_name: string | null; intake_completed_at: string | null } | null;
  };
  const members = (membersRes.data ?? []) as unknown as MemberRow[];
  const activeMembers = members.filter((m) => m.status === "active");
  const learners = activeMembers.filter((m) => m.role === "learner");
  const coaches = activeMembers.filter((m) => m.role === "coach");
  const consultantName =
    (consultantRes.data as { display_name: string | null } | null)?.display_name ?? null;

  const courses = (coursesRes.data ?? [])
    .map((cc) => cc.courses as unknown as { id: string; title: string; status: string } | null)
    .filter((c): c is { id: string; title: string; status: string } => c !== null);

  // Vitality signals — resolve by learner user_ids (no cohort_id column on these tables).
  const learnerUserIds = learners.map((l) => l.user_id);
  const [recentActivityRes, goalsRes, assessmentsRes] = await Promise.all([
    learnerUserIds.length > 0
      ? supabase
          .from("ai_conversations")
          .select("user_id, last_message_at")
          .in("user_id", learnerUserIds)
          .gte("last_message_at", since14)
      : Promise.resolve({ data: [] as { user_id: string; last_message_at: string | null }[] }),
    learnerUserIds.length > 0
      ? supabase.from("goals").select("user_id, status").in("user_id", learnerUserIds)
      : Promise.resolve({ data: [] as { user_id: string; status: string }[] }),
    learnerUserIds.length > 0
      ? supabase.from("assessments").select("user_id").in("user_id", learnerUserIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const activeUsers14d = new Set((recentActivityRes.data ?? []).map((r) => r.user_id));
  const intakePending = learners.filter((l) => !l.profiles?.intake_completed_at).length;
  const activeGoals = (goalsRes.data ?? []).filter((g) => g.status === "active").length;
  const assessmentUsers = new Set((assessmentsRes.data ?? []).map((a) => a.user_id));
  const learnersWithAnyAssessment = learners.filter((l) => assessmentUsers.has(l.user_id)).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex flex-wrap items-center gap-1 text-xs text-neutral-500"
      >
        <Link href="/super/orgs" className="hover:text-brand-blue">
          Organizations
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/super/orgs/${orgId}`} className="hover:text-brand-blue">
          {org.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-brand-navy">{cohort.name}</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-brand-navy">{cohort.name}</h1>
          {consultantName && (
            <span
              title="LeadShift consultant assigned to this cohort"
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
            >
              Consultant: {consultantName}
            </span>
          )}
        </div>
        {cohort.description && (
          <p className="mt-2 text-sm text-neutral-600">{cohort.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          {cohort.starts_at && <span>Starts {cohort.starts_at}</span>}
          {cohort.ends_at && <span>Ends {cohort.ends_at}</span>}
          {cohort.capstone_unlocks_at && (
            <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 font-medium text-brand-pink">
              Capstone unlocks {cohort.capstone_unlocks_at}
            </span>
          )}
          <span>Created {new Date(cohort.created_at).toLocaleDateString()}</span>
        </div>
      </header>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Stat
          label="Learners"
          value={learners.length}
          sublabel={`${coaches.length} coach${coaches.length === 1 ? "" : "es"}`}
        />
        <Stat
          label="Active 14d"
          value={learners.filter((l) => activeUsers14d.has(l.user_id)).length}
          sublabel="by AI activity"
          tone={
            learners.length > 0 &&
            learners.filter((l) => activeUsers14d.has(l.user_id)).length < learners.length / 2
              ? "warn"
              : "default"
          }
        />
        <Stat label="Active goals" value={activeGoals} sublabel="across learners" />
        <Stat
          label="Intake pending"
          value={intakePending}
          sublabel={`${learnersWithAnyAssessment} have assessments`}
          tone={intakePending > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Roster */}
        <div className="lg:col-span-2 rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-brand-navy">
              Roster ({activeMembers.length} active)
            </h2>
          </div>
          {activeMembers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              No active members in this cohort yet.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-50 max-h-[600px] overflow-auto">
              {activeMembers.map((m) => (
                <li key={m.id} className="px-4 py-3 hover:bg-brand-light transition">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/super/orgs/${orgId}/members/${m.user_id}`}
                      className="text-sm font-medium text-brand-navy hover:text-brand-blue"
                    >
                      {m.profiles?.display_name ?? "Unnamed"}
                    </Link>
                    <div className="flex items-center gap-2">
                      {m.consultant_user_id && (
                        <span
                          title="Per-learner consultant override"
                          className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
                        >
                          override
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBadgeClass(m.role)}`}
                      >
                        {labelForRole(m.role)}
                      </span>
                    </div>
                  </div>
                  {m.role === "learner" && (
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                      {!m.profiles?.intake_completed_at && (
                        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-neutral-600">
                          intake pending
                        </span>
                      )}
                      {!activeUsers14d.has(m.user_id) && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-200">
                          quiet 14d+
                        </span>
                      )}
                      {assessmentUsers.has(m.user_id) && (
                        <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-brand-blue">
                          assessment uploaded
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: courses + metadata */}
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-navy mb-2">
              Assigned courses ({courses.length})
            </h2>
            {courses.length === 0 ? (
              <p className="text-xs text-neutral-500">No courses assigned.</p>
            ) : (
              <ul className="space-y-1">
                {courses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/super/course-builder/${c.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-brand-light"
                    >
                      <span className="text-brand-navy truncate">{c.title}</span>
                      <span
                        className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.status === "published" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}
                      >
                        {c.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/super/orgs/${orgId}/assign-courses`}
              className="mt-3 block text-xs text-brand-blue hover:underline"
            >
              Edit course assignments →
            </Link>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-navy mb-2">Metadata</h2>
            <dl className="space-y-1.5 text-xs">
              <div>
                <dt className="text-neutral-500">Cohort ID</dt>
                <dd className="font-mono text-brand-navy">{cohort.id}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Consultant</dt>
                <dd className="text-brand-navy">{consultantName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Capstone unlock</dt>
                <dd className="text-brand-navy">{cohort.capstone_unlocks_at ?? "not set"}</dd>
              </div>
            </dl>
            <Link
              href={`/super/orgs/${orgId}`}
              className="mt-3 block text-xs text-brand-blue hover:underline"
            >
              Edit consultant / capstone on org page →
            </Link>
          </div>

          <CohortEditPanel
            orgId={orgId}
            cohort={{
              id: cohort.id,
              name: cohort.name,
              description: cohort.description,
              starts_at: cohort.starts_at,
              ends_at: cohort.ends_at,
            }}
            activeMemberCount={activeMembers.length}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: "default" | "warn";
}) {
  const bg = tone === "warn" ? "bg-amber-50" : "bg-white";
  return (
    <div className={`rounded-lg border border-neutral-200 ${bg} p-3 shadow-sm`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-brand-navy">{value}</div>
      {sublabel && <div className="text-[10px] text-neutral-500">{sublabel}</div>}
    </div>
  );
}
