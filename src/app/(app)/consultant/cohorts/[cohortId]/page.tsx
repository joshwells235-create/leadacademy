import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ cohortId: string }> };

type LearnerRow = {
  user_id: string;
  role: string;
  consultant_user_id: string | null;
  profiles: { display_name: string | null } | null;
};

export default async function ConsultantCohortPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cohort } = await supabase
    .from("cohorts")
    .select(
      "id, name, description, starts_at, ends_at, capstone_unlocks_at, consultant_user_id, organizations(id, name)",
    )
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: membersRaw } = await supabase
    .from("memberships")
    .select("user_id, role, consultant_user_id, profiles:user_id(display_name)")
    .eq("cohort_id", cohortId)
    .eq("status", "active");
  const members = (membersRaw ?? []) as unknown as LearnerRow[];

  // Scope to learners the viewer effectively consults on — either the
  // cohort default is them, or the learner has an override pointing to them.
  // Super-admin sees all.
  const isDefaultConsultant = cohort.consultant_user_id === user.id;
  const learnersAll = members.filter((m) => m.role === "learner");
  const learners = profile?.super_admin
    ? learnersAll
    : learnersAll.filter((m) => {
        const effective = m.consultant_user_id ?? cohort.consultant_user_id ?? null;
        return effective === user.id;
      });
  const coaches = members.filter((m) => m.role === "coach");

  // If the viewer doesn't effectively consult on any learner here, 404 —
  // they shouldn't be deep-linking into a cohort that isn't theirs.
  if (!profile?.super_admin && !isDefaultConsultant && learners.length === 0) {
    notFound();
  }

  // Pull per-learner signal: active sprint count, last action date, capstone
  // status. One query per dimension across all learners.
  const learnerIds = learners.map((l) => l.user_id);

  const [sprintsRes, actionsRes, capstonesRes] = await Promise.all([
    learnerIds.length
      ? supabase
          .from("goal_sprints")
          .select("user_id, status")
          .in("user_id", learnerIds)
          .eq("status", "active")
      : { data: [] as { user_id: string; status: string }[] },
    learnerIds.length
      ? supabase
          .from("action_logs")
          .select("user_id, occurred_on")
          .in("user_id", learnerIds)
          .order("occurred_on", { ascending: false })
      : { data: [] as { user_id: string; occurred_on: string }[] },
    learnerIds.length
      ? supabase.from("capstone_outlines").select("user_id, status").in("user_id", learnerIds)
      : { data: [] as { user_id: string; status: string }[] },
  ]);

  const activeSprintByUser = new Map<string, number>();
  for (const s of sprintsRes.data ?? []) {
    activeSprintByUser.set(s.user_id, (activeSprintByUser.get(s.user_id) ?? 0) + 1);
  }
  const lastActionByUser = new Map<string, string>();
  for (const a of actionsRes.data ?? []) {
    if (!lastActionByUser.has(a.user_id)) lastActionByUser.set(a.user_id, a.occurred_on);
  }
  const capstoneStatusByUser = new Map<string, string>();
  for (const c of capstonesRes.data ?? []) {
    capstoneStatusByUser.set(c.user_id, c.status);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/consultant/dashboard" className="hover:text-brand-blue">
          Your cohorts
        </Link>
        <span>/</span>
        <span className="font-medium text-brand-navy">{cohort.name}</span>
      </nav>

      <header className="mb-6">
        <p className="text-xs text-neutral-500">{cohort.organizations?.name ?? "Unknown org"}</p>
        <h1 className="mt-0.5 text-2xl font-bold text-brand-navy">{cohort.name}</h1>
        {cohort.description && (
          <p className="mt-2 text-sm text-neutral-600">{cohort.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-600">
          {cohort.starts_at && <span>Starts {cohort.starts_at}</span>}
          {cohort.ends_at && <span>Ends {cohort.ends_at}</span>}
          <span>{learners.length} learners</span>
          <span>{coaches.length} coaches</span>
          {cohort.capstone_unlocks_at && (
            <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 font-medium text-brand-pink">
              Capstone unlocks {cohort.capstone_unlocks_at}
            </span>
          )}
        </div>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-navy">Learners</h2>
        </div>
        {learners.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No learners in this cohort yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-50">
            {learners.map((l) => {
              const name = l.profiles?.display_name ?? "Unnamed learner";
              const active = activeSprintByUser.get(l.user_id) ?? 0;
              const lastAction = lastActionByUser.get(l.user_id) ?? null;
              const capstone = capstoneStatusByUser.get(l.user_id) ?? null;
              return (
                <li key={l.user_id}>
                  <Link
                    href={`/consultant/learners/${l.user_id}`}
                    className="flex items-center justify-between px-5 py-3 transition hover:bg-brand-light/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-navy">{name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                        <span>{active > 0 ? `${active} active sprint` : "No active sprint"}</span>
                        <span>
                          {lastAction ? `Last action ${lastAction}` : "No actions logged"}
                        </span>
                        {capstone && (
                          <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 font-medium text-brand-blue">
                            Capstone: {capstone}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-brand-blue">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {coaches.length > 0 && (
        <section className="mt-5 rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-brand-navy">Coaches in this cohort</h2>
          </div>
          <ul className="divide-y divide-neutral-50">
            {coaches.map((c) => (
              <li key={c.user_id} className="px-5 py-3 text-sm text-brand-navy">
                {c.profiles?.display_name ?? "Unnamed coach"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
