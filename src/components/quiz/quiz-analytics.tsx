export type QuizAnalyticsData = {
  totalAttempts: number;
  uniqueLearners: number;
  passRate: number; // 0..1
  averageScore: number; // 0..100
  perQuestion: Array<{
    questionId: string;
    prompt: string;
    correctRate: number; // 0..1
    attempts: number;
  }>;
};

/**
 * Super-admin-only quiz engagement card. Renders below the quiz builder
 * on the lesson editor so authors can see how their questions are
 * performing — low correctRate per-question signals a confusingly-worded
 * or too-hard question.
 */
export function QuizAnalytics({ data }: { data: QuizAnalyticsData }) {
  if (data.totalAttempts === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
        No attempts yet — analytics will appear here once learners start taking this quiz.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-brand-navy mb-3">Engagement</h3>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <Stat label="Total attempts" value={data.totalAttempts.toLocaleString()} />
        <Stat label="Unique learners" value={data.uniqueLearners.toLocaleString()} />
        <Stat
          label="Pass rate"
          value={`${Math.round(data.passRate * 100)}%`}
          tone={data.passRate >= 0.7 ? "good" : data.passRate >= 0.4 ? "warn" : "bad"}
        />
        <Stat label="Avg score" value={`${Math.round(data.averageScore)}%`} />
      </div>

      {data.perQuestion.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-neutral-600 mb-2">
            Per-question correctness (lowest = rework candidates)
          </h4>
          <ul className="space-y-1.5">
            {[...data.perQuestion]
              .sort((a, b) => a.correctRate - b.correctRate)
              .map((q) => (
                <li key={q.questionId} className="flex items-center gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-neutral-700 truncate">
                        {q.prompt.slice(0, 80)}
                        {q.prompt.length > 80 ? "…" : ""}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full ${
                          q.correctRate >= 0.7
                            ? "bg-emerald-500"
                            : q.correctRate >= 0.4
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.round(q.correctRate * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 w-16 text-right font-mono">
                    {Math.round(q.correctRate * 100)}% · {q.attempts}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const color = {
    default: "text-brand-navy",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  }[tone];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
