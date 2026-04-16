import { createClient } from "@/lib/supabase/server";

const PLACEHOLDER_SECTIONS: { title: string; phase: string; description: string }[] = [
  {
    title: "Growth Goals",
    phase: "Phase 1",
    description: "Coach-assisted SMART goals across leading self, others, and organization.",
  },
  {
    title: "Action Log",
    phase: "Phase 1",
    description: "Log what you did, reflect, connect each action to a goal.",
  },
  {
    title: "Reflections",
    phase: "Phase 2",
    description: "Daily journal with AI-surfaced themes and patterns.",
  },
  {
    title: "Daily Challenge",
    phase: "Phase 2",
    description: "One small leadership act per day, suggested by your coach.",
  },
  {
    title: "Assessments",
    phase: "Phase 3",
    description: "Upload PI, EQ-i, and 360 reports. Your coach weaves them in.",
  },
  {
    title: "Coach Sessions",
    phase: "Phase 4",
    description: "Pre-session prep, coach notes, session recaps, action items.",
  },
  {
    title: "Learning Modules",
    phase: "Phase 5",
    description: "Courses and lessons assigned to your cohort.",
  },
  {
    title: "Messages + Community",
    phase: "Phase 6–7",
    description: "Direct messages with your coach; cohort feed.",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name, super_admin").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(name, slug), cohorts(name)")
      .eq("user_id", user!.id)
      .eq("status", "active"),
  ]);

  const firstName =
    profile?.display_name?.split(" ")[0] ?? user!.email?.split("@")[0] ?? "there";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {memberships && memberships.length > 0 ? (
            <>
              You're in{" "}
              <span className="font-medium text-neutral-900">
                {memberships[0].organizations?.name}
              </span>
              {memberships[0].cohorts?.name ? (
                <>
                  {" — "}
                  {memberships[0].cohorts.name} cohort
                </>
              ) : null}
              {" as a "}
              <span className="font-medium text-neutral-900">{memberships[0].role}</span>.
            </>
          ) : profile?.super_admin ? (
            "You're a LeadShift super-admin. Start by creating an org."
          ) : (
            "You don't have an active membership yet. Ask your admin for an invite."
          )}
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Phase 0 is live.</p>
        <p className="mt-1">
          Auth, orgs, and RLS are working. The sections below unlock as later phases ship.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {s.phase}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
