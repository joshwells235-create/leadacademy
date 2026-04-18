import { CoachChat } from "@/components/chat/coach-chat";

type Props = {
  searchParams: Promise<{
    mode?: string;
    lens?: string;
  }>;
};

export default async function CoachChatPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode: "general" | "goal" = sp.mode === "goal" ? "goal" : "general";
  const lens: "self" | "others" | "org" | undefined =
    sp.lens === "self" || sp.lens === "others" || sp.lens === "org" ? sp.lens : undefined;

  const lensLabel =
    lens === "self"
      ? "Leading Self"
      : lens === "others"
        ? "Leading Others"
        : lens === "org"
          ? "Leading the Organization"
          : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-brand-navy">
          {mode === "goal"
            ? lensLabel
              ? `Draft a goal — starting from ${lensLabel}`
              : "Draft a goal"
            : "Coach"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {mode === "goal" ? (
            <>
              Every goal in LeadAcademy has to land across all three lenses — how it changes{" "}
              <em>you</em>, the people <em>around</em> you, and the <em>organization</em>. The coach
              will help you get there.
            </>
          ) : (
            <>
              Talk through anything — a situation at work, something you're noticing, a half-formed
              goal. The coach knows your active goals and recent actions.
            </>
          )}
        </p>
      </div>
      <CoachChat
        mode={mode}
        goalContext={lens ? { primaryLens: lens } : undefined}
        emptyHint={
          mode === "goal" ? (
            <p>
              Start by telling the coach what you want to grow in
              {lensLabel ? ` — starting from ${lensLabel.toLowerCase()} is fine` : ""}. They'll help
              you see how it lights up the other two lenses too.
            </p>
          ) : (
            <div className="space-y-2">
              <p>A few ways to start:</p>
              <ul className="mx-auto inline-block text-left text-neutral-600">
                <li>• "I want to set a goal for leading my team better."</li>
                <li>• "Something happened at work today I want to think through."</li>
                <li>• "How should I use my 1:1s more effectively?"</li>
              </ul>
            </div>
          )
        }
      />
    </div>
  );
}
