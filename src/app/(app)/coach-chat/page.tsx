import { CoachChat } from "@/components/chat/coach-chat";

type Props = {
  searchParams: Promise<{
    mode?: string;
    tier?: string;
  }>;
};

export default async function CoachChatPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode: "general" | "goal" = sp.mode === "goal" ? "goal" : "general";
  const tier: "self" | "others" | "org" | undefined =
    sp.tier === "self" || sp.tier === "others" || sp.tier === "org" ? sp.tier : undefined;

  const tierLabel =
    tier === "self"
      ? "Leading Self"
      : tier === "others"
        ? "Leading Others"
        : tier === "org"
          ? "Leading the Organization"
          : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">
          {mode === "goal" ? (tierLabel ? `Draft a ${tierLabel} goal` : "Draft a goal") : "Coach"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {mode === "goal"
            ? "The coach will walk you through SMART criteria, then save the goal when it's ready."
            : "Talk through anything — a situation at work, something you're noticing, a half-formed goal. The coach knows your active goals and recent actions."}
        </p>
      </div>
      <CoachChat
        mode={mode}
        goalContext={tier ? { tier } : undefined}
        emptyHint={
          mode === "goal" ? (
            <div>
              <p>
                Start by telling the coach what you want to grow in
                {tierLabel ? ` under ${tierLabel.toLowerCase()}` : ""}. They'll ask the rest.
              </p>
            </div>
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
