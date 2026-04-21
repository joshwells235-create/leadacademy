import Link from "next/link";
import { notFound } from "next/navigation";
import { CapstoneReadonly } from "@/components/capstone/capstone-readonly";
import { type CoachFlaggedQuestion, FlaggedQuestions } from "@/components/coach/flagged-questions";
import { ProfileReadonly } from "@/components/profile/profile-readonly";
import { getSinceLastSessionStats } from "@/lib/coach/since-last-session";
import { createClient } from "@/lib/supabase/server";
import { ActionItemsPanel } from "./action-items-panel";
import { CoachNoteEditor } from "./coach-note-editor";
import { LearnerNav } from "./learner-nav";
import { RecapForm } from "./recap-form";
import { SinceStrip } from "./since-strip";
import { ThoughtPartnerActivity } from "./thought-partner-activity";

type Props = { params: Promise<{ id: string }> };

export default async function CoachLearnerPage({ params }: Props) {
  const { id: learnerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Verify coach assignment — or allow super_admins (who use this view
  // to observe any coach/learner pair).
  const { data: assignment } = await supabase
    .from("coach_assignments")
    .select("id, org_id")
    .eq("coach_user_id", user.id)
    .eq("learner_user_id", learnerId)
    .is("active_to", null)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!assignment && !profile?.super_admin) notFound();

  // Sibling assignments so we can render prev/next learner navigation.
  const { data: siblingAssignments } = await supabase
    .from("coach_assignments")
    .select("learner_user_id, cohort_id, cohorts(name)")
    .eq("coach_user_id", user.id)
    .is("active_to", null);

  const siblingIds = (siblingAssignments ?? []).map((s) => s.learner_user_id);
  const { data: siblingProfiles } =
    siblingIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", siblingIds)
      : { data: [] };
  const siblingProfileMap = new Map(
    (siblingProfiles ?? []).map((p) => [p.user_id, p.display_name ?? "Unnamed learner"]),
  );
  const siblings = (siblingAssignments ?? [])
    .map((s) => ({
      id: s.learner_user_id,
      name: siblingProfileMap.get(s.learner_user_id) ?? "Unnamed learner",
      cohort: s.cohorts?.name ?? "",
    }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort) || a.name.localeCompare(b.name));
  const currentIdx = siblings.findIndex((s) => s.id === learnerId);
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next =
    currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  const today = new Date().toISOString().slice(0, 10);

  const [
    learnerProfile,
    goalsRes,
    sprintsRes,
    goalActionCountsRes,
    actionsRes,
    reflectionsRes,
    assessmentRes,
    preSessionRes,
    coachNoteRes,
    recapsRes,
    itemsRes,
    capstoneRes,
    conversationsRes,
    nudgesRes,
    flaggedQuestionsRes,
    sinceStats,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, timezone, role_title, function_area, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, company_size, industry, context_notes, intake_completed_at",
      )
      .eq("user_id", learnerId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select(
        "id, title, status, primary_lens, target_date, impact_self, impact_others, impact_org",
      )
      .eq("user_id", learnerId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_sprints")
      .select(
        "id, goal_id, sprint_number, title, practice, planned_end_date, action_count, created_at, status",
      )
      .eq("user_id", learnerId)
      .eq("status", "active"),
    supabase
      .from("action_logs")
      .select("goal_id, occurred_on")
      .eq("user_id", learnerId)
      .not("goal_id", "is", null),
    supabase
      .from("action_logs")
      .select("id, description, occurred_on, impact_area, reflection")
      .eq("user_id", learnerId)
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("reflections")
      .select("id, content, themes, reflected_on")
      .eq("user_id", learnerId)
      .order("reflected_on", { ascending: false })
      .limit(5),
    supabase.from("assessments").select("ai_summary").eq("user_id", learnerId).maybeSingle(),
    supabase
      .from("pre_session_notes")
      .select("id, want_to_discuss, whats_been_hard, whats_going_well, session_date, created_at")
      .eq("user_id", learnerId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("coach_notes")
      .select("id, content, updated_at")
      .eq("coach_user_id", user.id)
      .eq("learner_user_id", learnerId)
      .maybeSingle(),
    supabase
      .from("session_recaps")
      .select("id, session_date, content, created_at")
      .eq("learner_user_id", learnerId)
      .order("session_date", { ascending: false })
      .limit(5),
    supabase
      .from("action_items")
      .select("id, title, description, due_date, completed, completed_at")
      .eq("learner_user_id", learnerId)
      .order("completed")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("capstone_outlines")
      .select("outline, status, shared_at, finalized_at, updated_at")
      .eq("user_id", learnerId)
      .maybeSingle(),
    supabase
      .from("ai_conversations")
      .select("id, title, mode, last_message_at")
      .eq("user_id", learnerId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("coach_nudges")
      .select("id, pattern, created_at, acted_at, dismissed_at")
      .eq("user_id", learnerId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("lesson_questions")
      .select(
        "id, lesson_id, question, ai_answer, asked_at, flagged_to_coach_at, coach_response, coach_responded_at, lessons(id, title, modules(course_id, courses(id, title)))",
      )
      .eq("user_id", learnerId)
      .not("flagged_to_coach_at", "is", null)
      .is("resolved_at", null)
      .order("flagged_to_coach_at", { ascending: false })
      .limit(20),
    getSinceLastSessionStats(supabase, user.id, learnerId),
  ]);

  const name = learnerProfile.data?.display_name ?? "Unnamed learner";

  // Per-goal action counts + active sprint info for vitality display.
  const actionByGoal = new Map<string, { count: number; lastOccurredOn: string }>();
  for (const row of goalActionCountsRes.data ?? []) {
    if (!row.goal_id) continue;
    const existing = actionByGoal.get(row.goal_id);
    if (!existing) {
      actionByGoal.set(row.goal_id, { count: 1, lastOccurredOn: row.occurred_on });
    } else {
      existing.count += 1;
      if (row.occurred_on > existing.lastOccurredOn) existing.lastOccurredOn = row.occurred_on;
    }
  }
  const sprintByGoal = new Map((sprintsRes.data ?? []).map((s) => [s.goal_id, s] as const));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {siblings.length > 1 && (
        <div className="mb-4">
          <LearnerNav prev={prev} next={next} position={currentIdx + 1} total={siblings.length} />
        </div>
      )}

      <div className="mb-3 text-xs text-neutral-500">
        <Link href="/coach/dashboard" className="hover:text-brand-blue">
          ← All learners
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Everything you need before and after a session.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            const { startCoachPartnerSessionAction } = await import(
              "@/lib/coach-partner/start-session-action"
            );
            await startCoachPartnerSessionAction(learnerId);
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md border border-brand-blue/30 bg-white px-3 py-1.5 text-sm font-medium text-brand-blue transition hover:bg-brand-blue hover:text-white"
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-brand-pink" />
            Think this through with Thought Partner →
          </button>
        </form>
      </div>

      <div className="mb-6">
        <SinceStrip stats={sinceStats} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column: learner data */}
        <div className="space-y-5">
          {/* Profile */}
          <Section title="Profile (from intake)">
            <ProfileReadonly profile={learnerProfile.data ?? null} />
          </Section>

          {/* Goals */}
          <Section title="Goals" count={goalsRes.data?.length}>
            {(goalsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No active goals.</p>
            ) : (
              (goalsRes.data ?? []).map((g) => {
                const sprint = sprintByGoal.get(g.id);
                const stats = actionByGoal.get(g.id);
                const sprintDay = sprint
                  ? Math.min(
                      daysBetween(sprint.created_at.slice(0, 10), today) + 1,
                      Math.max(
                        1,
                        daysBetween(sprint.created_at.slice(0, 10), sprint.planned_end_date),
                      ),
                    )
                  : null;
                const sprintTotalDays = sprint
                  ? Math.max(
                      1,
                      daysBetween(sprint.created_at.slice(0, 10), sprint.planned_end_date),
                    )
                  : null;
                return (
                  <div key={g.id} className="border-l-2 border-neutral-200 pl-3 py-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">{g.title}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {g.status.replace("_", " ")}
                          {g.target_date && <> · target {g.target_date}</>}
                        </p>
                      </div>
                    </div>
                    {sprint && sprintDay != null && sprintTotalDays != null ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 font-medium text-brand-blue">
                          Sprint {sprint.sprint_number} · day {sprintDay}/{sprintTotalDays}
                        </span>
                        <span className="text-neutral-600">
                          {sprint.action_count} action{sprint.action_count === 1 ? "" : "s"} this
                          sprint
                        </span>
                      </div>
                    ) : stats ? (
                      <p className="mt-1 text-[11px] text-neutral-500">
                        No active sprint · {stats.count} total action{stats.count === 1 ? "" : "s"}
                        {stats.count > 0 && (
                          <> · last {formatShortDate(stats.lastOccurredOn, today)}</>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-neutral-400">No sprint, no actions yet</p>
                    )}
                    {sprint?.practice && (
                      <p className="mt-1 text-[11px] italic text-neutral-600">
                        Practicing: {sprint.practice}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </Section>

          {/* Recent actions */}
          <Section title="Recent actions" count={actionsRes.data?.length}>
            {(actionsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No actions logged yet.</p>
            ) : (
              (actionsRes.data ?? []).map((a) => (
                <div key={a.id} className="text-sm">
                  <span className="mr-2 text-xs text-neutral-500">{a.occurred_on}</span>
                  {a.description}
                  {a.reflection && (
                    <p className="mt-0.5 text-xs italic text-neutral-500">{a.reflection}</p>
                  )}
                </div>
              ))
            )}
          </Section>

          {/* Reflections */}
          <Section title="Recent reflections" count={reflectionsRes.data?.length}>
            {(reflectionsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No reflections yet.</p>
            ) : (
              (reflectionsRes.data ?? []).map((r) => (
                <ReflectionItem
                  key={r.id}
                  date={r.reflected_on}
                  content={r.content}
                  themes={r.themes ?? []}
                />
              ))
            )}
          </Section>

          {/* Assessments */}
          <Section title="Assessment summary">
            {assessmentRes.data?.ai_summary &&
            typeof assessmentRes.data.ai_summary === "object" &&
            Object.keys(assessmentRes.data.ai_summary).length > 0 ? (
              <div className="text-sm text-neutral-700">
                {Object.entries(
                  assessmentRes.data.ai_summary as Record<string, { summary?: string }>,
                )
                  .filter(([key]) => !key.startsWith("_"))
                  .map(([key, val]) => (
                    <div key={key} className="mb-2">
                      <div className="text-xs font-medium uppercase text-neutral-800">
                        {key === "pi"
                          ? "Predictive Index"
                          : key === "eqi"
                            ? "EQ-i 2.0"
                            : key === "threesixty"
                              ? "360 Feedback"
                              : key}
                      </div>
                      {val?.summary && <p>{val.summary}</p>}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No assessments uploaded.</p>
            )}
          </Section>

          {/* Thought-partner activity — read-only awareness. */}
          <ThoughtPartnerActivity
            conversations={conversationsRes.data ?? []}
            nudges={nudgesRes.data ?? []}
            anchorDate={sinceStats.anchorDate}
          />

          {/* Flagged lesson questions — learner wants a human take. */}
          <FlaggedQuestions
            rows={(
              (flaggedQuestionsRes.data ?? []) as unknown as Array<{
                id: string;
                lesson_id: string;
                question: string;
                ai_answer: string | null;
                asked_at: string;
                flagged_to_coach_at: string | null;
                coach_response: string | null;
                coach_responded_at: string | null;
                lessons: {
                  id: string;
                  title: string;
                  modules: {
                    course_id: string;
                    courses: { id: string; title: string } | { id: string; title: string }[] | null;
                  } | null;
                } | null;
              }>
            ).map((r): CoachFlaggedQuestion => {
              const lesson = r.lessons;
              const courses = lesson?.modules?.courses;
              const course = Array.isArray(courses) ? courses[0] : courses;
              return {
                id: r.id,
                learnerUserId: learnerId,
                lessonId: r.lesson_id,
                lessonTitle: lesson?.title ?? "(removed lesson)",
                courseId: course?.id ?? null,
                courseTitle: course?.title ?? null,
                question: r.question,
                aiAnswer: r.ai_answer,
                askedAt: r.asked_at,
                flaggedAt: r.flagged_to_coach_at ?? r.asked_at,
                coachResponse: r.coach_response,
                coachRespondedAt: r.coach_responded_at,
              };
            })}
          />
        </div>

        {/* Right column: coach tools */}
        <div className="space-y-5">
          {/* Pre-session notes */}
          <Section title="Pre-session notes — from learner" count={preSessionRes.data?.length}>
            {(preSessionRes.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">Learner hasn't submitted prep notes yet.</p>
            ) : (
              (preSessionRes.data ?? []).map((n) => (
                <div key={n.id} className="border-l-2 border-brand-navy/30 pl-3 py-1 text-sm">
                  <div className="text-xs text-neutral-500">
                    {n.session_date
                      ? `For session ${n.session_date}`
                      : `Submitted ${new Date(n.created_at).toLocaleDateString()}`}
                  </div>
                  <p className="font-medium">{n.want_to_discuss}</p>
                  {n.whats_been_hard && (
                    <p className="mt-1 text-xs text-neutral-600">
                      <span className="font-medium">Hard:</span> {n.whats_been_hard}
                    </p>
                  )}
                  {n.whats_going_well && (
                    <p className="mt-1 text-xs text-neutral-600">
                      <span className="font-medium">Well:</span> {n.whats_going_well}
                    </p>
                  )}
                </div>
              ))
            )}
          </Section>

          {/* Coach notes */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your notes</h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                Private to you
              </span>
            </div>
            <CoachNoteEditor
              learnerId={learnerId}
              initialContent={coachNoteRes.data?.content ?? ""}
            />
          </div>

          {/* Session recaps */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Session recaps</h2>
              <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                Visible to learner
              </span>
            </div>
            <RecapForm
              learnerId={learnerId}
              hasAnyRecap={(recapsRes.data ?? []).length > 0}
              defaultSessionDate={defaultRecapDate(
                (preSessionRes.data ?? [])[0]?.session_date ?? null,
              )}
            />
            {(recapsRes.data ?? []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(recapsRes.data ?? []).map((r) => (
                  <div key={r.id} className="border-l-2 border-neutral-200 pl-3 text-sm">
                    <div className="text-xs text-neutral-500">{r.session_date}</div>
                    <ClampedText text={r.content} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action items */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Action items</h2>
              <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                Visible to learner
              </span>
            </div>
            <ActionItemsPanel learnerId={learnerId} items={itemsRes.data ?? []} today={today} />
          </div>

          {/* Capstone */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Capstone</h2>
            <CapstoneReadonly row={capstoneRes.data ?? null} viewerRole="coach" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold">
        {title}
        {count != null ? ` (${count})` : ""}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReflectionItem({
  date,
  content,
  themes,
}: {
  date: string;
  content: string;
  themes: string[];
}) {
  return (
    <div className="text-sm">
      <span className="mr-2 text-xs text-neutral-500">{date}</span>
      <ClampedText text={content} />
      {themes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {themes.map((t) => (
            <span key={t} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px]">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ClampedText({ text }: { text: string }) {
  // Full text — no clamping. Coach needs to read reflection/recap
  // content to prep, and a click-to-expand just adds friction. If a
  // single reflection is very long the section scrolls; that's fine.
  return <p className="whitespace-pre-wrap text-neutral-700">{text}</p>;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

function formatShortDate(iso: string, today: string): string {
  if (iso === today) return "today";
  const diff = daysBetween(iso, today);
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  return iso.slice(5);
}

function defaultRecapDate(preSessionSessionDate: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  // If learner's most recent pre-session note names a session date,
  // anchor there — that's almost certainly the session the coach is
  // recapping. Otherwise default to yesterday (typical "write up
  // yesterday's call" workflow).
  if (preSessionSessionDate && preSessionSessionDate <= today) return preSessionSessionDate;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}
