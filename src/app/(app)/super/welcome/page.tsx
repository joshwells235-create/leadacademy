import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LaunchTourButton } from "@/components/super/launch-tour-button";
import { createClient } from "@/lib/supabase/server";
import { WelcomeDismiss } from "./welcome-dismiss";

export const metadata: Metadata = {
  title: "Welcome, super admin — Leadership Academy",
};

/**
 * Onboarding walkthrough for new LeadShift super admins. Surfaces every
 * super-admin surface we've shipped so far, in the order a new admin
 * would actually use them: orgs → cohorts → invites → learner detail
 * → cross-org user ops → content → communication → audit. The "dismiss"
 * button flips a localStorage flag the /super/orgs callout reads, so
 * once they've seen it the new-admin banner goes away.
 */
export default async function SuperWelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const firstName = profile.display_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Welcome, super admin
        </p>
        <h1
          className="mt-3 leading-[1.05] text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(32px, 4.5vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          What you can do here, {firstName}.
        </h1>
        <p className="mt-4 max-w-[640px] text-[15px] leading-[1.6] text-ink-soft">
          As a super admin you can build and manage the whole platform — every
          organization, every cohort, every learner. This is a tour of the
          surfaces and the moves you'll do most. Read top-to-bottom; each
          section ends with a link to actually try it.
        </p>
        <p className="mt-3 max-w-[640px] text-[13px] italic text-ink-soft">
          Tip: press <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[11px] not-italic">⌘K</kbd> from anywhere
          to jump to any page or search for any learner across orgs.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LaunchTourButton variant="primary">
            ✦ Take the interactive tour instead →
          </LaunchTourButton>
          <span className="text-[12px] text-ink-faint">
            spotlights the real buttons across live screens — about two minutes
          </span>
        </div>
      </header>

      <Step
        n="1"
        title="The five-second mental model"
        intro="One platform, many tenants. Everything is scoped through this hierarchy:"
      >
        <ul className="mt-3 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>Organization</strong> — a client (e.g. MMG Insurance). Every
            user belongs to at least one org.
          </li>
          <li>
            <strong>Cohort</strong> — a group of learners moving through a
            program together. Lives under one org. A cohort can have a default
            consultant and a capstone unlock date.
          </li>
          <li>
            <strong>Membership</strong> — the row that ties a user to an org +
            cohort with a role: <code>learner</code>, <code>coach</code>,{" "}
            <code>org_admin</code>, or <code>consultant</code>.
          </li>
          <li>
            <strong>You</strong> — super admin. Cuts across every org. The only
            role that can create orgs, change emails / passwords, soft-delete
            users, or grant super-admin to someone else.
          </li>
        </ul>
      </Step>

      <Step
        n="2"
        title="Organizations — your home base"
        intro="Everything starts at /super/orgs. The page shows every client org, with vitality chips for each (active members, AI spend, cohort count)."
      >
        <p className="mt-2 text-[14px] text-ink-soft">
          From there you can:
        </p>
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>Spin up a new org with <strong>+ New org</strong> (top-right).</li>
          <li>Click any org card to drop into its detail page.</li>
        </ul>
        <TryIt href="/super/orgs">Go to Organizations</TryIt>
      </Step>

      <Step
        n="3"
        title="Inside an org: cohorts, consultants, members"
        intro="The org detail page is the densest screen you'll use. Three things matter here:"
      >
        <div className="mt-3 space-y-3 text-[14px] text-ink-soft">
          <div>
            <p className="font-semibold text-ink">Cohorts panel (left)</p>
            <p>
              Create cohorts, set a <em>capstone unlock date</em> (the date the
              capstone surface opens for learners in that cohort), and assign a
              consultant. You're in the consultant picker too — pick yourself
              if you're going to facilitate the cohort.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Add member panel (right top)</p>
            <p>
              Two modes. <strong>Invite member</strong> sends an invite link
              (uses Supabase SMTP if configured; otherwise copy the link out of
              the success banner and share manually). <strong>Manually add user</strong> creates
              a confirmed account with a temp password — use this when email is
              flaky or for fast onboarding.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Members list (right bottom)</p>
            <p>
              Searchable / filterable. Click any name to open the per-learner
              detail.
            </p>
          </div>
        </div>
      </Step>

      <Step
        n="4"
        title="The per-learner detail page — the most powerful screen"
        intro="When you click a learner from the org members list, you land on a screen showing every signal we have about them: goals, sprints, actions, reflections, assessments, AI conversations, coach notes, capstone state."
      >
        <p className="mt-2 text-[14px] text-ink-soft">From here you can:</p>
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>Change their coach</strong> — Coach panel near the bottom,
            dropdown of org coaches (plus you, if you're a super admin
            flexing in).
          </li>
          <li>
            <strong>Set a consultant override</strong> — for cases like the
            Open Academy where one cohort spans multiple consultants.
          </li>
          <li>
            <strong>Delete wrong assessment docs</strong> — Uploaded assessment
            files panel. Use this when the wrong PDF got uploaded; the file +
            extracted summary + parent assessment row are all cleaned up.
          </li>
          <li>
            <strong>Trigger memory distillation</strong> or{" "}
            <strong>run nudge detection</strong> — AI triggers panel, useful
            for support debugging.
          </li>
          <li>
            Click their name in the top-right to jump to their full user-edit
            console — email, password, sessions, super-admin toggle, soft
            delete, cross-org membership moves.
          </li>
        </ul>
      </Step>

      <Step
        n="5"
        title="Cross-org user management — /super/users"
        intro="When you need to find a person without knowing what org they're in, /super/users is the global directory."
      >
        <p className="mt-2 text-[14px] text-ink-soft">
          Search by name, click in, and you get the full edit console. From
          one screen you can:
        </p>
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>Edit any profile field.</li>
          <li>
            Change their email (with or without forcing re-verification).
          </li>
          <li>
            <strong>Set their password directly</strong> — bypasses email
            entirely, returns a temp password you share out-of-band. Use this
            when corporate scanners are eating reset links.
          </li>
          <li>Revoke all their sessions (force re-login).</li>
          <li>
            Toggle super-admin — this is how you'll add the next super admin
            after you.
          </li>
          <li>
            Move their membership to a different org / cohort, archive /
            unarchive, soft-delete / restore.
          </li>
        </ul>
        <p className="mt-3 text-[13px] italic text-ink-soft">
          Fastest path: press <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[11px] not-italic">⌘K</kbd>,
          type the person's name, and hit Enter.
        </p>
        <TryIt href="/super/users">Go to global Users</TryIt>
      </Step>

      <Step
        n="6"
        title="AI quality control"
        intro="The thought partner is the moat — it's also the surface most likely to misbehave silently. Three places to watch:"
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>/super/conversations</strong> — every conversation across
            every learner, filterable by org / mode / date. Click in to read
            the full transcript and delete it if needed.
          </li>
          <li>
            <strong>/super/ai-errors</strong> — failed AI calls grouped by
            feature. Empty is good; spikes mean something's misconfigured.
          </li>
          <li>
            <strong>/super/ai-usage</strong> — token + spend tracking. Has a
            daily sparkbar and per-org breakdown.
          </li>
        </ul>
      </Step>

      <Step
        n="7"
        title="Content — courses, paths, certificates, resources"
        intro="All learning content is global (no org_id). You build it once, assign it to cohorts."
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>/super/course-builder</strong> — Tiptap rich-text editor.
            Build courses → modules → lessons. Lessons can be content,
            quizzes, or (coming soon) practice scenarios. Each course has a
            per-cohort analytics page.
          </li>
          <li>
            <strong>/super/learning-paths</strong> — bundle courses into a
            curated sequence. Assigning a path to a cohort auto-materializes
            individual course assignments.
          </li>
          <li>
            <strong>/super/certificates</strong> — cross-org certificate
            issuance log. Revoke or restore individual certs.
          </li>
          <li>
            <strong>/super/resources</strong> — the global resource library
            learners see at /resources.
          </li>
        </ul>
      </Step>

      <Step
        n="8"
        title="Communication"
        intro="Broadcast banners and community moderation."
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>/super/announcements</strong> — write a banner. Target
            globally, by org, by cohort, or by role. Per-user dismissals are
            tracked.
          </li>
          <li>
            <strong>/super/moderation</strong> — community posts + comments,
            searchable / filterable. Delete the rare bad post; LeadShift takes
            the load off org admins.
          </li>
        </ul>
      </Step>

      <Step
        n="9"
        title="Audit + export"
        intro="Everything destructive you do is logged. Everything is exportable."
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>/super/activity</strong> — every super.* action with
            actor, target, and details. Filter by scope / org / actor / date.
            CSV export.
          </li>
          <li>
            <strong>/super/export</strong> — pull data out as CSV by type
            (members, goals, reflections, etc.), scoped to an org or global.
          </li>
        </ul>
      </Step>

      <Step
        n="10"
        title="You can also be a coach or consultant — at the same time"
        intro="LeadShift super admins often facilitate cohorts or coach learners directly. The product knows this."
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            You appear as a valid candidate in every cohort's consultant
            picker, tagged <code>(super)</code> so it's clear you don't hold a
            consultant membership in that org.
          </li>
          <li>
            Same for the coach picker on any learner's detail page.
          </li>
          <li>
            Once assigned, the coachee or cohort shows up in your own{" "}
            <Link href="/coach/dashboard" className="text-accent underline">
              Coach
            </Link>{" "}
            and{" "}
            <Link href="/consultant/dashboard" className="text-accent underline">
              Consultant
            </Link>{" "}
            portals — switchable from the <strong>Portals</strong> pill in
            the top nav.
          </li>
        </ul>
      </Step>

      <Step
        n="11"
        title="⌘K is your shortcut"
        intro="The command palette is the fastest way to do anything in this app."
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>Press <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd> (or Ctrl+K) from any page.</li>
          <li>
            Type a page name (e.g. "users", "course builder") to jump to it.
          </li>
          <li>Type a learner's name or email to deep-link straight to their detail page across any org.</li>
          <li>↑ / ↓ to move, Enter to open, Esc to close.</li>
        </ul>
      </Step>

      <Step
        n="12"
        title="A few principles that hold across the platform"
        intro=""
      >
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-soft">
          <li>
            <strong>Approval moments are intentional.</strong> When the
            thought partner proposes saving a goal, starting a sprint, etc.,
            the learner confirms before it lands. You'll see the same pills
            when reviewing transcripts.
          </li>
          <li>
            <strong>Memory is per-learner.</strong> The thought partner
            distills durable facts about each learner from idle conversations.
            View / edit at <code>/memory</code> (as the learner), or in the
            super-admin learner detail panel.
          </li>
          <li>
            <strong>Proactivity is opt-in-by-default but learner-controlled.</strong>{" "}
            The TP can reach out up to 2x / week. Each learner can disable
            this from their <code>/memory</code> page.
          </li>
          <li>
            <strong>Soft delete, not hard delete.</strong> When you delete a
            user via the super console, their profile is marked deleted, their
            memberships are archived, and their sessions are revoked. Their
            data stays put so audits + recovery are possible. <code>restoreUser</code> reverses it.
          </li>
        </ul>
      </Step>

      <footer className="mt-12 border-t border-rule pt-6">
        <p className="text-[14px] text-ink-soft">
          That's the tour. If a surface feels confusing or you spot a missing
          capability, flag it — this product is still actively evolving and
          your feedback shapes what gets built next.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <WelcomeDismiss />
          <Link
            href="/super/orgs"
            className="inline-flex items-center rounded-full border border-rule px-4 py-2 text-[13px] font-medium text-ink-soft transition hover:text-ink"
          >
            Go to Organizations
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Step({
  n,
  title,
  intro,
  children,
}: {
  n: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          {n.padStart(2, "0")}
        </span>
        <h2
          className="text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400 }}
        >
          {title}
        </h2>
      </div>
      {intro && (
        <p className="mt-3 text-[14px] leading-[1.65] text-ink-soft">{intro}</p>
      )}
      {children}
    </section>
  );
}

function TryIt({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white"
      style={{ background: "var(--t-accent)" }}
    >
      {children} →
    </Link>
  );
}
