export const MEMBER_ROLES = ["learner", "coach", "org_admin", "consultant"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/**
 * Single source of truth for role display labels. Used anywhere a role
 * is rendered to a human (admin portal, invite forms, activity log,
 * member badges). DB-level raw role names should never leak into the UI.
 */
export const ROLE_LABEL: Record<MemberRole, string> = {
  learner: "Learner",
  coach: "Coach",
  org_admin: "Org Admin",
  consultant: "Consultant",
};

export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  learner:
    "Participates in the program — has goals, sprints, reflections, assessments, and their own thought-partner conversations.",
  coach:
    "The learner's human executive coach. Writes session recaps and action items, reviews notes between 1:1s. Assigned to learners one-to-many.",
  org_admin:
    "Manages this organization — invites members, runs cohorts, assigns coaches, configures program settings. High-impact role.",
  consultant:
    "LeadShift program-delivery role. Read access across cohorts they consult on; can assign coaches and edit cohort metadata. Usually set by LeadShift, not the org.",
};

/** Role badge color tokens — used on member tables, invite lists, activity log. */
export const ROLE_BADGE_CLASS: Record<MemberRole, string> = {
  learner: "bg-neutral-100 text-neutral-700",
  coach: "bg-brand-blue/10 text-brand-blue",
  org_admin: "bg-brand-navy/10 text-brand-navy",
  consultant: "bg-amber-50 text-amber-800",
};

export function labelForRole(role: string): string {
  return (MEMBER_ROLES as readonly string[]).includes(role) ? ROLE_LABEL[role as MemberRole] : role;
}

export function roleBadgeClass(role: string): string {
  return (MEMBER_ROLES as readonly string[]).includes(role)
    ? ROLE_BADGE_CLASS[role as MemberRole]
    : "bg-neutral-100 text-neutral-700";
}
