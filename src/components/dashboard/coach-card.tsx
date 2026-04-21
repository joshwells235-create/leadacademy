import Link from "next/link";
import { Panel } from "@/components/design/panel";

// The coach card carries the human coach's voice into the learner's
// daily view — one action item they asked for, one due date. Blue
// left-rule marks it as the coach's ground (pink is the AI's voice;
// blue is the human coach's). If there's no open item, the card
// surfaces the most recent recap's date so the coach stays present
// even in the quiet periods.
//
// Deliberately restrained: no toggle to complete here, no long body.
// The full action list lives in the action-items surface; this card
// is a reminder, not the workspace.
export function CoachCard({
  coachName,
  item,
  lastRecapAt,
}: {
  coachName: string | null;
  item: {
    id: string;
    title: string;
    due_date: string | null;
  } | null;
  lastRecapAt: string | null;
}) {
  return (
    <Panel style={{ borderLeft: "3px solid var(--t-blue)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue">
        {coachName ? `${coachName} · your coach` : "Your coach"}
      </p>

      {item ? (
        <>
          <p className="mt-2.5 text-[13.5px] leading-[1.55] text-ink">
            {item.title}
          </p>
          {item.due_date && (
            <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              Due {formatDue(item.due_date)}
            </p>
          )}
        </>
      ) : lastRecapAt ? (
        <>
          <p className="mt-2.5 text-[13.5px] leading-[1.55] text-ink-soft">
            Nothing on your plate from your coach right now.
          </p>
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Last recap · {formatDue(lastRecapAt)}
          </p>
        </>
      ) : (
        <p className="mt-2.5 text-[13.5px] leading-[1.55] text-ink-soft">
          Your coach hasn't sent anything yet. When they do, it'll show up here.
        </p>
      )}

      <Link
        href="/pre-session"
        className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft hover:text-blue"
      >
        Pre-session notes →
      </Link>
    </Panel>
  );
}

// Due date formatted as "Thu Apr 24" to match the mono label voice.
// The date string coming in is a date-only ISO (YYYY-MM-DD); parse
// with an explicit local midnight to avoid timezone drift on the
// client side.
function formatDue(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}
