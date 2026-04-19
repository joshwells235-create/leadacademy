type Conversation = {
  id: string;
  title: string | null;
  mode: string;
  last_message_at: string | null;
};

type Nudge = {
  id: string;
  pattern: string;
  created_at: string;
  acted_at: string | null;
  dismissed_at: string | null;
};

const MODE_LABEL: Record<string, string> = {
  general: "General chat",
  goal: "Goal drafting",
  reflection: "Reflection",
  assessment: "Assessment debrief",
  capstone: "Capstone",
  intake: "Intake",
};

const NUDGE_LABEL: Record<string, string> = {
  sprint_ending_soon: "Sprint ending soon",
  sprint_needs_review: "Sprint needs review",
  challenge_followup: "Challenge follow-up",
  undebriefed_assessment: "Un-debriefed assessment",
  sprint_quiet: "Sprint quiet",
  reflection_streak_broken: "Reflection streak broken",
  new_course_waiting: "New course waiting",
  momentum_surge: "Momentum surge",
  goal_check_in: "Goal check-in",
};

/**
 * Read-only awareness of what the learner is doing with the AI thought
 * partner. The coach can't open the conversation (private to the
 * learner), but knowing "your learner is actively working on their
 * goals" or "the thought partner just nudged them about a quiet sprint"
 * meaningfully shapes the coaching session.
 */
export function ThoughtPartnerActivity({
  conversations,
  nudges,
  anchorDate,
}: {
  conversations: Conversation[];
  nudges: Nudge[];
  anchorDate: string;
}) {
  const hasActivity = conversations.length > 0 || nudges.length > 0;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Thought-partner activity</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          AI · private to learner
        </span>
      </div>
      {!hasActivity ? (
        <p className="text-sm text-neutral-500">No recent AI activity.</p>
      ) : (
        <div className="space-y-3">
          {conversations.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Recent conversations
              </p>
              <ul className="mt-1 space-y-1">
                {conversations.map((c) => {
                  const isNew = c.last_message_at && c.last_message_at.slice(0, 10) > anchorDate;
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                          {MODE_LABEL[c.mode] ?? c.mode}
                        </span>
                        {c.title ?? "(untitled)"}
                      </span>
                      <span className="shrink-0 text-[11px] text-neutral-500">
                        {c.last_message_at
                          ? new Date(c.last_message_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                        {isNew && (
                          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-blue align-middle" />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {nudges.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Recent AI nudges
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {nudges.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-neutral-700">
                      {NUDGE_LABEL[n.pattern] ?? n.pattern}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {n.acted_at ? "acted" : n.dismissed_at ? "dismissed" : "pending"} ·{" "}
                      {new Date(n.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
