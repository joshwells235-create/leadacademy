import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { IntakeCtaButton } from "@/components/intake/intake-cta-button";
import { ArcStrip, type ArcMilestone } from "@/components/dashboard/arc-strip";
import { ChallengeCard } from "@/components/dashboard/challenge-card";
import { CoachCard } from "@/components/dashboard/coach-card";
import { CourseCard } from "@/components/dashboard/course-card";
import { DensityLayout } from "@/components/dashboard/density-layout";
import { GreetingBlock } from "@/components/dashboard/greeting-block";
import { MemoryCard } from "@/components/dashboard/memory-card";
import { ReflectionCard } from "@/components/dashboard/reflection-card";
import { SprintCard } from "@/components/dashboard/sprint-card";
import { TPHero } from "@/components/dashboard/tp-hero";
import type { TransparencySource } from "@/components/dashboard/tp-transparency-modal";
import { detectAndFireNudge } from "@/lib/ai/nudges/detect";
import { getVisibleAnnouncements } from "@/lib/announcements/get-visible";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { assembleDashboardData } from "@/lib/dashboard/assemble";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Today — Leadership Academy" };

// The dashboard is the learner's daily return. The new design rebuilds
// it as two co-equal density modes (Focus / Overview) around a single
// always-prominent Thought-Partner moment. Cards pull from real data
// via `assembleDashboardData`; the first-time / intake flows are
// preserved because they're product-critical onboarding, but their
// visual language now matches the editorial kit.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Coach-primary users land on their coaching home, not the learner
  // dashboard. Super-admins and hybrid users fall through.
  const roleCtx = await getUserRoleContext(supabase, user.id);
  if (roleCtx.coachPrimary) redirect("/coach/dashboard");

  // Core data assembly — everything the cards need.
  const data = await assembleDashboardData(supabase, user.id);

  // Side-kick queries that don't belong in the shared assembler (they
  // only matter for the dashboard's own onboarding flow).
  const [profileRes, goalsRes, reflectionsRes, convRes, membershipRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("intake_completed_at, super_admin")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("goals")
        .select("id, status")
        .eq("user_id", user.id)
        .neq("status", "archived"),
      supabase.from("reflections").select("id").eq("user_id", user.id),
      supabase
        .from("ai_conversations")
        .select("id, title, last_message_at")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

  const profile = profileRes.data;
  const totalGoals = goalsRes.data?.length ?? 0;
  const totalReflections = reflectionsRes.data?.length ?? 0;
  const hasMembership = !!membershipRes.data;
  const recentConversation = convRes.data;

  // "First time" = no real practice yet (no goals, no reflections). We
  // intentionally don't key off conversations — intake creates one, and
  // that would flip a learner out of first-time state the moment they
  // finished intake, skipping their cue to set a goal.
  const isFirstTime = totalGoals === 0 && totalReflections === 0;

  // Run proactive nudge detection on dashboard visits (skip first-time —
  // no signal to nudge on). Respects `proactivity_enabled` and rate limits
  // inside the detector.
  if (!isFirstTime) {
    await detectAndFireNudge(supabase, user.id);
  }

  // Fire-and-forget memory distillation for any conversation that's been
  // idle ≥2h. The previous trigger only fired when a NEW conversation
  // started, which meant learners who kept one conversation open saw an
  // empty `learner_memory` table indefinitely. Triggering from the
  // dashboard closes that gap so facts actually accumulate. The helper
  // internally claims each row before the LLM call to avoid races with
  // concurrent triggers.
  if (!isFirstTime) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (membership?.org_id) {
      const { distillPendingConversations } = await import(
        "@/lib/ai/memory/distill-pending"
      );
      // No await — run in the background so the dashboard isn't blocked
      // on a Sonnet call.
      void distillPendingConversations({
        userScoped: supabase,
        userId: user.id,
        orgId: membership.org_id,
      });
    }
  }

  // Load the most recent pending nudge — drives the TP hero when present.
  const { data: pendingNudge } = await supabase
    .from("coach_nudges")
    .select("id, pattern, notification_id, notifications(title, body, link, read_at)")
    .eq("user_id", user.id)
    .is("acted_at", null)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nudgeNotif = pendingNudge?.notifications as
    | { title: string; body: string; link: string | null }
    | null
    | undefined;

  // Intake CTA — rendered above the TP hero when pending; the TP hero
  // itself doesn't belong until intake is done because every chat turn's
  // context still lacks the "about this leader" block.
  const intakePending = hasMembership && !profile?.intake_completed_at;

  // System announcements for this user.
  const announcements = await getVisibleAnnouncements(supabase, user.id);

  // The TP hero's shape — nudge takes priority, recent conversation is
  // the fallback, otherwise welcome framing.
  const tpShape: Parameters<typeof TPHero>[0]["shape"] = nudgeNotif
    ? {
        kind: "nudge",
        id: pendingNudge!.id,
        title: nudgeNotif.title,
        body: nudgeNotif.body,
        href: nudgeNotif.link ?? `/coach-chat/from-nudge/${pendingNudge!.id}`,
        groundedIn: groundedInFor(pendingNudge?.pattern ?? null, data),
      }
    : recentConversation
      ? {
          kind: "resume",
          conversationId: recentConversation.id,
          lastMessageAt: recentConversation.last_message_at,
          title: recentConversation.title,
        }
      : {
          kind: "welcome",
          firstName: data?.firstName ?? "there",
        };

  const milestones = buildMilestones(data);

  return (
    <div className="relative mx-auto max-w-[1440px] px-6 py-8 lg:px-12 lg:py-12">
      {announcements.length > 0 && (
        <div className="mb-6 space-y-2">
          {announcements.map((a) => (
            <AnnouncementBanner key={a.id} announcement={a} />
          ))}
        </div>
      )}

      {/* Intake CTA — the only full-width block that ever sits above the
          greeting. Surfaced whenever intake is pending (first-time or a
          freshly-reset learner) so the TP always has its "about this
          leader" block before the dashboard shifts into its normal shape. */}
      {intakePending && (
        <div
          className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5"
          style={{
            border: "1px solid var(--t-rule)",
            background: "var(--t-paper)",
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              Before we dig in
            </p>
            <h2
              className="mt-1 text-ink"
              style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400 }}
            >
              Tell your thought partner about yourself.
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              A quick conversation so every future exchange feels like it already knows
              you — your role, team, company, and anything else worth knowing. Takes
              about five minutes.
            </p>
          </div>
          <IntakeCtaButton>Start intake →</IntakeCtaButton>
        </div>
      )}

      {/* Greeting — always visible when we have a first name. For
          first-time learners, the accent phrase frames the invitation;
          once they have a live sprint, the phrase switches to reflect
          the sprint's state. */}
      <GreetingBlock
        firstName={data?.firstName ?? "there"}
        programWeek={data?.program.week ?? null}
        programTotal={data?.program.total ?? null}
        sprintNumber={data?.activeSprint?.sprintNumber ?? null}
        sprintDay={data?.activeSprint?.day ?? null}
        accentPhrase={derivAccentPhrase(isFirstTime, data?.activeSprint ?? null)}
        tail={derivAccentTail(isFirstTime, data?.activeSprint ?? null)}
        density="overview"
      />

      {/* TP Hero — always prominent. Only suppressed during the intake
          CTA state, where it would compete for attention with the
          required first-step action. */}
      {!intakePending && (
        <TPHero
          shape={tpShape}
          density="overview"
          transparencySources={buildTransparencySources(data)}
        />
      )}

      {/* First-time learners: the three-step "your first steps" card
          that replaces the dashboard grid until they have real practice
          to render. Retained verbatim from the pre-redesign flow
          because it's product-critical onboarding. */}
      {isFirstTime && !intakePending && (
        <div
          className="mt-7 rounded-2xl p-7"
          style={{
            border: "1px solid var(--t-rule)",
            background: "var(--t-paper)",
          }}
        >
          <h2
            className="mb-1 text-ink"
            style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400 }}
          >
            Your first steps.
          </h2>
          <p className="mb-6 text-sm text-ink-soft">
            Do these in any order — most take about 5 minutes. Uploading
            assessments takes longer because you'll need the PDF reports.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <StepCard
              number="1"
              title="Talk with your thought partner"
              description="Tell it what you're working on. It already has your profile — no setup."
              href="/coach-chat"
              cta="Start a conversation"
              done={!!recentConversation}
              estimate="~5 min"
            />
            <StepCard
              number="2"
              title="Set a growth goal"
              description="Your thought partner drafts it with you — one that changes you, your team, and your org."
              href="/coach-chat?mode=goal"
              cta="Draft a goal"
              done={totalGoals > 0}
              estimate="~10 min"
            />
            <StepCard
              number="3"
              title="Upload your assessments"
              description="Add your PI, EQ-i, or 360 reports so coaching is grounded in real data."
              href="/assessments"
              cta="Upload reports"
              done={false}
              estimate="when you have the PDFs"
            />
          </div>
        </div>
      )}

      {/* ── Returning-learner layout — Focus + Overview density modes ── */}
      {!isFirstTime && data && (
        <DensityLayout
          focus={
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <SprintCard
                sprint={data.activeSprint}
                goal={data.activeSprint?.goal ?? null}
                actionDays={data.activeSprint?.actionDays ?? []}
                recentActions={data.activeSprint?.recentActions ?? []}
                sprintNumber={data.activeSprint?.sprintNumber ?? null}
                compact
              />
              <ChallengeCard compact initialStreak={data.dailyChallengeStreak} />
            </div>
          }
          overview={
            <div className="mt-7 space-y-5">
              {/* Row 1: Sprint (1.4fr) + [Challenge + Coach] stacked (1fr) */}
              <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
                <SprintCard
                  sprint={data.activeSprint}
                  goal={data.activeSprint?.goal ?? null}
                  actionDays={data.activeSprint?.actionDays ?? []}
                  recentActions={data.activeSprint?.recentActions ?? []}
                  sprintNumber={data.activeSprint?.sprintNumber ?? null}
                />
                <div className="grid gap-5">
                  <ChallengeCard initialStreak={data.dailyChallengeStreak} />
                  <CoachCard
                    coachName={data.coachName}
                    item={data.coachItem}
                    lastRecapAt={data.lastRecapAt}
                  />
                </div>
              </div>
              {/* Row 2: three columns — Reflection, Course, Memory */}
              <div className="grid gap-5 md:grid-cols-3">
                <ReflectionCard reflection={data.recentReflection} />
                <CourseCard course={data.currentCourse} />
                <MemoryCard
                  facts={data.memoryFacts}
                  context={data.contextSummary}
                />
              </div>
              {/* Row 3: full-width arc strip (only when we know program dates) */}
              {data.program.week !== null && data.program.total !== null && (
                <ArcStrip
                  programWeek={data.program.week}
                  programTotal={data.program.total}
                  capstoneDate={data.program.capstoneDate}
                  milestones={milestones}
                />
              )}
            </div>
          }
        />
      )}
    </div>
  );
}

// Greeting accent phrase — swap based on sprint state. Short tails read
// best here; anything above six words reads like a slogan.
function derivAccentPhrase(
  isFirstTime: boolean,
  sprint: { day: number; totalDays: number; actionCount: number; actionGoal: number } | null,
): string | undefined {
  if (isFirstTime) return "Let's set this up together.";
  if (!sprint) return "Ready when you are.";
  const midway = sprint.totalDays > 0 && sprint.day >= sprint.totalDays / 2;
  if (midway) return "The sprint is landing —";
  return "Pick up where we left off —";
}

function derivAccentTail(
  isFirstTime: boolean,
  sprint: { day: number; totalDays: number } | null,
): string {
  if (isFirstTime) return "";
  if (!sprint) return "what's on your mind?";
  const midway = sprint.totalDays > 0 && sprint.day >= sprint.totalDays / 2;
  if (midway) return "let's look at what it's telling us.";
  return "";
}

// The TP hero's grounded-in strip. Derived per nudge-pattern so we
// don't claim context we don't actually have. In a follow-up we can
// swap this for a real context-ref read.
function groundedInFor(
  pattern: string | null,
  data: Awaited<ReturnType<typeof assembleDashboardData>>,
): string[] {
  const out: string[] = [];
  if (data?.activeSprint) {
    out.push(`${data.activeSprint.actionCount} sprint actions`);
  }
  if (data?.recentReflection) {
    out.push("last reflection");
  }
  if (data?.lastRecapAt) {
    out.push("last recap");
  }
  if (pattern) out.push(pattern.replace(/_/g, " "));
  return out.slice(0, 5);
}

// Build the "how it knew" source list for the TP transparency modal.
// Derived from the same assembled data the hero renders against so the
// list reflects the actual context the TP is reading from on this turn.
// Each entry is a (title, short description) pair — the learner sees
// the pink-dot list + the italic privacy footer in the modal.
function buildTransparencySources(
  data: Awaited<ReturnType<typeof assembleDashboardData>>,
): TransparencySource[] {
  if (!data) return [];
  const out: TransparencySource[] = [];

  if (data.activeSprint) {
    out.push({
      title: `Last ${data.activeSprint.actionCount} sprint actions`,
      description:
        "Every pause moment you've logged this sprint — timestamps, context, tags.",
    });
  }
  if (data.recentReflection) {
    const snippet = data.recentReflection.content.slice(0, 80).trim();
    out.push({
      title: "Your most recent reflection",
      description: snippet ? `"${snippet}${snippet.length === 80 ? "…" : ""}"` : "Your latest journal entry.",
    });
  }
  if (data.lastRecapAt) {
    out.push({
      title: "Last recap with your coach",
      description: "The patterns your human coach flagged at your last session.",
    });
  }
  if (data.currentCourse) {
    out.push({
      title: `Course in progress: ${data.currentCourse.courseTitle}`,
      description:
        "Lesson notes and progress from your current module feed the thread.",
    });
  }
  if (data.memoryFacts.length > 0) {
    out.push({
      title: `${data.memoryFacts.length} memory ${data.memoryFacts.length === 1 ? "fact" : "facts"} you've confirmed`,
      description:
        "Durable things the TP has learned about you across conversations — edit them in /memory.",
    });
  }
  return out;
}

// Build the arc-strip milestones from cohort metadata. Until we have a
// real program-dates model, we synthesize a reasonable set: Intake → a
// sprint marker at each completed sprint → the current sprint (active)
// → Capstone. Phase 7 replaces this with real program dates.
function buildMilestones(
  data: Awaited<ReturnType<typeof assembleDashboardData>>,
): ArcMilestone[] {
  const total = data?.program.total ?? 36;
  const week = data?.program.week ?? 1;
  const milestones: ArcMilestone[] = [
    { week: 1, label: "Intake" },
    { week: Math.round(total * 0.25), label: "Sprint 01" },
    { week: Math.round(total * 0.5), label: "Assessments" },
  ];
  if (data?.activeSprint) {
    milestones.push({
      week,
      label: `Sprint ${String(data.activeSprint.sprintNumber).padStart(2, "0")}`,
      active: true,
    });
  }
  milestones.push({ week: Math.round(total * 0.85), label: "Integrate" });
  milestones.push({ week: total, label: "Capstone" });
  // Dedupe accidental overlaps (e.g. active sprint at week 1).
  const seen = new Map<number, ArcMilestone>();
  for (const m of milestones) {
    const existing = seen.get(m.week);
    if (!existing || m.active) seen.set(m.week, m);
  }
  return Array.from(seen.values()).sort((a, b) => a.week - b.week);
}

function StepCard({
  number,
  title,
  description,
  href,
  cta,
  done,
  estimate,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  estimate?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 transition"
      style={{
        border: "1px solid var(--t-rule)",
        background: "var(--t-paper)",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: done ? "var(--t-blue)" : "var(--t-ink)" }}
        >
          {done ? "✓" : number}
        </span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <p className="mb-3 text-xs text-ink-soft">{description}</p>
      {!done ? (
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: "var(--t-accent)" }}
          >
            {cta} →
          </Link>
          {estimate && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              {estimate}
            </span>
          )}
        </div>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-blue">
          Done
        </span>
      )}
    </div>
  );
}
