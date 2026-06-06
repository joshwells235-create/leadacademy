/**
 * Humanize an activity_logs action key into a readable phrase. Mirrors
 * the map in /super/activity's view; kept here as a plain (non-client)
 * module so server components (the journey timeline) can use it too.
 */
const ACTION_LABEL: Record<string, string> = {
  "invitation.created": "Invited a new member",
  "invitation.resent": "Resent an invitation",
  "invitation.revoked": "Revoked an invitation",
  "membership.role_changed": "Changed a member's role",
  "membership.archived": "Archived a member",
  "membership.unarchived": "Unarchived a member",
  "membership.cohort_reassigned": "Moved a member between cohorts",
  "membership.bulk_archived": "Bulk archived members",
  "membership.bulk_unarchived": "Bulk unarchived members",
  "membership.bulk_cohort_reassigned": "Bulk moved members between cohorts",
  "membership.manually_added": "Manually created a user",
  "membership.created_from_invitation": "Accepted an invitation",
  "coach_assignment.created": "Assigned a coach",
  "coach_assignment.cleared": "Cleared a coach assignment",
  "cohort.created": "Created a cohort",
  "cohort.updated": "Updated a cohort",
  "cohort.archived": "Archived a cohort",
  "super.org.created": "Created an organization",
  "super.org.updated": "Updated an organization",
  "super.cohort.created": "Created a cohort",
  "super.cohort.updated": "Updated a cohort",
  "super.cohort.archived": "Archived a cohort",
  "super.cohort.course_assigned": "Assigned a course to a cohort",
  "super.cohort.course_removed": "Removed a course from a cohort",
  "super.invitation.created": "Invited a member",
  "super.invitation.revoked": "Revoked an invitation",
  "super.membership.manually_added": "Manually added a member",
  "super.membership.archived": "Archived a membership",
  "super.membership.unarchived": "Unarchived a membership",
  "super.membership.role_changed": "Changed a membership role",
  "super.membership.moved_org": "Moved a membership to a new org",
  "super.coach_assignment.created": "Assigned a coach",
  "super.coach_assignment.cleared": "Cleared a coach assignment",
  "super.user.profile_updated": "Edited a user profile",
  "super.user.email_changed": "Changed a user's email",
  "super.user.email_confirmed": "Confirmed a user's email",
  "super.user.password_reset_sent": "Sent a password reset",
  "super.user.password_set_directly": "Set a password directly",
  "super.user.sessions_revoked": "Revoked a user's sessions",
  "super.user.super_admin_granted": "Granted super-admin",
  "super.user.super_admin_revoked": "Revoked super-admin",
  "super.user.soft_deleted": "Soft-deleted a user",
  "super.user.restored": "Restored a user",
  "super.artifact.assessment_doc_deleted": "Deleted an assessment doc",
  "super.certificate.revoked": "Revoked a certificate",
  "super.certificate.restored": "Restored a certificate",
  "super.post.deleted": "Deleted a community post",
  "super.comment.deleted": "Deleted a community comment",
  "super.path.created": "Created a learning path",
  "super.path.updated": "Updated a learning path",
  "super.path.deleted": "Deleted a learning path",
  "super.path.assigned": "Assigned a learning path",
  "super.path.unassigned": "Unassigned a learning path",
};

export function humanizeAction(action: string): string {
  return (
    ACTION_LABEL[action] ??
    action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
