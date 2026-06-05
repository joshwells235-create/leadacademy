import type { TourSampleData } from "./tour-data";

export type TourStep = {
  /** Route this step lives on. Next/Back navigate here when it differs
   *  from the current pathname. */
  path: string;
  /** data-tour attribute value to spotlight. Omit for a centered card. */
  selector?: string;
  title: string;
  body: string;
  /** Optional override for the advance-button label. */
  cta?: string;
};

/**
 * Builds the spotlight-tour step list from real sample IDs. Steps that
 * need an org / member are dropped when the platform has none yet, so a
 * brand-new install still gets a coherent (shorter) tour.
 */
export function buildTourSteps(sample: TourSampleData): TourStep[] {
  const steps: TourStep[] = [];

  // 1 — intro (centered, on /super/orgs)
  steps.push({
    path: "/super/orgs",
    title: "Let me show you around — for real",
    body: "I'll spotlight the actual buttons and walk you across the real screens you'll use. Use Next / Back to move; nothing changes until you click something yourself. Takes about two minutes.",
    cta: "Start",
  });

  // 2 — create org
  steps.push({
    path: "/super/orgs",
    selector: "super-new-org",
    title: "Spin up a client org",
    body: "Every client is an organization. This is where you create one. After you do, you drop straight into its detail page to set up cohorts and invite people.",
  });

  // 3 — org list
  steps.push({
    path: "/super/orgs",
    selector: "super-org-list",
    title: "Every client lives here",
    body: "Each card is one org, with vitality chips — active members, AI spend, cohort count. Click any card to manage it. I'll open one for you next.",
  });

  if (sample.orgId) {
    const base = `/super/orgs/${sample.orgId}`;
    // 4 — cohort panel
    steps.push({
      path: base,
      selector: "super-cohort-panel",
      title: "Cohorts, consultants & capstone",
      body: "Create cohorts here, set each one's capstone-unlock date, and assign a consultant. You show up in the consultant picker too — pick yourself if you're facilitating.",
    });
    // 5 — invite panel
    steps.push({
      path: base,
      selector: "super-invite-panel",
      title: "Add people to this org",
      body: "Invite sends a link (or copy it out if email isn't wired up yet). Manually add user creates a confirmed account with a temp password — the fast path when you're onboarding someone right now.",
    });
    // 6 — members list
    steps.push({
      path: base,
      selector: "super-members-list",
      title: "The roster",
      body: "Searchable and filterable. Click any name to open that person's detail page — the single most powerful screen in the whole app.",
    });
  }

  if (sample.memberOrgId && sample.memberUserId) {
    // 7 — learner detail / coach panel
    steps.push({
      path: `/super/orgs/${sample.memberOrgId}/members/${sample.memberUserId}`,
      selector: "super-coach-panel",
      title: "The learner detail page",
      body: "Everything about one person — goals, sprints, reflections, assessments, AI conversations. You can reassign their coach right here, set a consultant override, or clean up a wrong assessment upload. The link up top opens the full user-edit console.",
    });
  }

  // 8 — global users search
  steps.push({
    path: "/super/users",
    selector: "super-users-search",
    title: "Find anyone, any org",
    body: "When you don't know which org someone is in, search the global directory. Click a name for the full console — change email, set a password directly, toggle super-admin (this is how you'll add the next admin), move them between orgs.",
  });

  // 9 — ⌘K (nav element, present everywhere; stay on /super/users)
  steps.push({
    path: "/super/users",
    selector: "nav-cmdk",
    title: "⌘K is the fast path",
    body: "Press ⌘K (or Ctrl+K) from anywhere to jump to any page or search a learner across every org. Once you know your way around, this becomes how you navigate.",
  });

  // 10 — finish (centered)
  steps.push({
    path: "/super/users",
    title: "That's the core loop",
    body: "Orgs → cohorts → people → the learner detail page, with ⌘K to move fast. The full written reference lives under Portals → Super: Get oriented → Welcome / Tour whenever you want depth. Go build.",
    cta: "Finish",
  });

  return steps;
}
