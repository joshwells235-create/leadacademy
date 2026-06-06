/**
 * Turn a raw route path into a human-readable screen name for the
 * super-admin journey timeline. Pattern-matches the route families we
 * care about; falls back to a prettified version of the path.
 */
export function humanizePath(rawPath: string): string {
  const path = rawPath.replace(/\/+$/, "") || "/";
  const seg = path.split("/").filter(Boolean);

  // Exact / prefix matches, most specific first.
  const exact: Record<string, string> = {
    "/dashboard": "Dashboard (Today)",
    "/goals": "Goals",
    "/action-log": "Action Log",
    "/reflections": "Reflections",
    "/assessments": "Assessments",
    "/certificates": "Certificates",
    "/resources": "Resources",
    "/capstone": "Capstone",
    "/learning": "Learning catalog",
    "/community": "Community",
    "/messages": "Messages",
    "/coach-chat": "Thought Partner chat",
    "/memory": "Memory",
    "/profile": "Profile",
    "/pre-session": "Pre-session prep",
    "/coach/dashboard": "Coaching Home",
    "/coach/journal": "Coach Journal",
    "/consultant/dashboard": "Consultant Dashboard",
    "/admin/dashboard": "Org Admin · Dashboard",
    "/admin/people": "Org Admin · People",
    "/admin/cohorts": "Org Admin · Cohorts",
    "/admin/activity": "Org Admin · Activity",
    "/super/welcome": "Super · Welcome / Tour",
    "/super/orgs": "Super · Organizations",
    "/super/users": "Super · Users",
    "/super/invitations": "Super · Invitations",
    "/super/course-builder": "Super · Course Builder",
    "/super/learning-paths": "Super · Learning Paths",
    "/super/certificates": "Super · Certificates",
    "/super/resources": "Super · Resources",
    "/super/announcements": "Super · Announcements",
    "/super/moderation": "Super · Moderation",
    "/super/ai-usage": "Super · AI Usage",
    "/super/conversations": "Super · AI Conversations",
    "/super/ai-errors": "Super · AI Errors",
    "/super/activity": "Super · Activity Log",
    "/super/export": "Super · Data Export",
  };
  if (exact[path]) return exact[path];

  // Dynamic patterns.
  if (seg[0] === "super" && seg[1] === "orgs" && seg.length === 3) {
    return "Super · Org detail";
  }
  if (seg[0] === "super" && seg[1] === "orgs" && seg[3] === "members") {
    return "Super · Learner detail";
  }
  if (seg[0] === "super" && seg[1] === "orgs" && seg[3] === "cohorts") {
    return "Super · Cohort detail";
  }
  if (seg[0] === "super" && seg[1] === "users" && seg.length === 3) {
    return "Super · User console";
  }
  if (seg[0] === "super" && seg[1] === "course-builder") {
    return "Super · Course Builder (editing)";
  }
  if (seg[0] === "super" && seg[1] === "conversations" && seg.length === 3) {
    return "Super · Conversation transcript";
  }
  if (seg[0] === "coach" && seg[1] === "learners") {
    return "Coach · Learner view";
  }
  if (seg[0] === "consultant" && seg[1] === "learners") {
    return "Consultant · Learner view";
  }
  if (seg[0] === "consultant" && seg[1] === "cohorts") {
    return "Consultant · Cohort view";
  }
  if (seg[0] === "learning" && seg.length >= 2) {
    return "Learning · Course / lesson";
  }
  if (seg[0] === "goals" && seg.length === 2) {
    return "Goal detail";
  }
  if (seg[0] === "messages" && seg.length === 2) {
    return "Message thread";
  }
  if (seg[0] === "admin" && seg[1] === "cohorts") {
    return "Org Admin · Cohort detail";
  }

  // Fallback: prettify the path.
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " "))
    .join(" › ");
}
