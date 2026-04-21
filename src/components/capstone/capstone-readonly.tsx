type SectionKind = "before" | "catalyst" | "shift" | "evidence" | "what_next";

type Section = {
  kind?: SectionKind;
  heading?: string;
  body?: string;
  moments?: { title: string; description: string }[];
  pull_quotes?: { text: string; source: string }[];
};

type OutlineJson = {
  sections?: Section[];
};

export type CapstoneReadonlyRow = {
  outline: unknown;
  status: string;
  shared_at: string | null;
  finalized_at: string | null;
  updated_at: string;
};

const SECTION_ORDER: SectionKind[] = ["before", "catalyst", "shift", "evidence", "what_next"];

const SECTION_LABEL: Record<SectionKind, string> = {
  before: "Before",
  catalyst: "Catalyst",
  shift: "Shift",
  evidence: "Evidence",
  what_next: "What's Next",
};

/**
 * Read-only capstone outline, for coach + admin learner views. If the
 * outline is in draft state the coach sees only status + counts — the
 * learner's unfinished story is private until they share it.
 */
export function CapstoneReadonly({
  row,
  viewerRole,
}: {
  row: CapstoneReadonlyRow | null;
  viewerRole: "coach" | "admin";
}) {
  if (!row) {
    return <p className="text-sm text-neutral-500">Learner hasn't started their capstone yet.</p>;
  }

  const outlineJson = (row.outline ?? {}) as OutlineJson;
  const sections = new Map<SectionKind, Section>();
  for (const s of outlineJson.sections ?? []) {
    if (s.kind && SECTION_ORDER.includes(s.kind)) {
      sections.set(s.kind, s);
    }
  }
  const filledCount = sections.size;

  if (row.status === "draft") {
    return (
      <div className="space-y-2 text-sm text-neutral-600">
        <p>
          <span className="font-medium">In draft</span> — {filledCount} of 5 sections shaped. The
          learner's draft is private to them until they share it with you.
        </p>
        <p className="text-xs text-neutral-500">
          Last updated {new Date(row.updated_at).toLocaleDateString()}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          Status:{" "}
          <span
            className={`font-medium ${
              row.status === "finalized" ? "text-emerald-700" : "text-brand-blue"
            }`}
          >
            {row.status === "finalized" ? "Finalized" : "Shared with coach"}
          </span>
        </span>
        <span>Updated {new Date(row.updated_at).toLocaleDateString()}</span>
      </div>

      {SECTION_ORDER.map((kind) => {
        const s = sections.get(kind);
        if (!s?.body) {
          return (
            <div
              key={kind}
              className="rounded-md border border-dashed border-neutral-200 p-3 text-xs text-neutral-400"
            >
              {SECTION_LABEL[kind]} — not yet written
            </div>
          );
        }
        return (
          <div key={kind} className="rounded-md border border-neutral-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
              {SECTION_LABEL[kind]}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-brand-navy">{s.heading}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{s.body}</p>
            {s.moments && s.moments.length > 0 && (
              <ul className="mt-2 space-y-0.5 rounded bg-brand-light p-2 text-xs text-neutral-700">
                {s.moments.map((m) => (
                  <li key={m.title}>
                    <span className="font-medium">{m.title}:</span> {m.description}
                  </li>
                ))}
              </ul>
            )}
            {s.pull_quotes && s.pull_quotes.length > 0 && (
              <div className="mt-2 space-y-1">
                {s.pull_quotes.map((q) => (
                  <blockquote
                    key={`${q.source}-${q.text.slice(0, 24)}`}
                    className="border-l-2 border-brand-blue pl-2 text-xs italic text-neutral-700"
                  >
                    "{q.text}" <span className="not-italic text-neutral-500">— {q.source}</span>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {viewerRole === "coach" && row.status === "shared" && (
        <p className="text-[11px] italic text-neutral-500">
          The learner has shared this with you — raise it in your next session.
        </p>
      )}
    </div>
  );
}
