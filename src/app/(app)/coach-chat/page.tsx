import type { UIMessage } from "ai";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachChat } from "@/components/chat/coach-chat";
import { ConversationsSidebar } from "@/components/chat/conversations-sidebar";
import { listConversations } from "@/lib/ai/conversation/list-conversations";
import { loadConversation } from "@/lib/ai/conversation/load-conversation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Thought Partner — Leadership Academy" };

const AUTO_RESUME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Mode = "general" | "goal" | "reflection" | "assessment" | "capstone" | "intake";
type Lens = "self" | "others" | "org";

type Props = {
  searchParams: Promise<{
    c?: string;
    mode?: string;
    lens?: string;
    new?: string;
  }>;
};

export default async function CoachChatPage({ searchParams }: Props) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await listConversations(supabase, user.id);

  const requestedMode: Mode =
    sp.mode === "goal" ||
    sp.mode === "reflection" ||
    sp.mode === "assessment" ||
    sp.mode === "capstone" ||
    sp.mode === "intake"
      ? (sp.mode as Mode)
      : "general";
  const requestedLens: Lens | undefined =
    sp.lens === "self" || sp.lens === "others" || sp.lens === "org" ? sp.lens : undefined;

  const explicitNew = sp.new === "1" || sp.mode != null || sp.lens != null;

  // Resolve target conversation.
  let target = sp.c ? await loadConversation(supabase, sp.c) : null;
  if (!target && !sp.c && !explicitNew && conversations.length > 0) {
    const mostRecent = conversations[0];
    const anchor = mostRecent.lastMessageAt ?? mostRecent.createdAt;
    if (Date.now() - new Date(anchor).getTime() < AUTO_RESUME_MAX_AGE_MS) {
      target = await loadConversation(supabase, mostRecent.id);
    }
  }

  // The active mode comes from a resumed conversation if present, otherwise
  // from the query param.
  const activeMode: Mode = target
    ? target.mode === "goal" ||
      target.mode === "reflection" ||
      target.mode === "assessment" ||
      target.mode === "capstone" ||
      target.mode === "intake"
      ? (target.mode as Mode)
      : "general"
    : requestedMode;
  const activeLens: Lens | undefined = target ? pickLens(target.contextRef) : requestedLens;

  const lensLabel = lensLabelFor(activeLens);
  const heading = headingFor(activeMode, lensLabel, target?.title ?? null);

  const initialMessages: UIMessage[] | undefined = target
    ? (target.messages as unknown as UIMessage[])
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 lg:flex-row">
        <ConversationsSidebar conversations={conversations} activeId={target?.id ?? null} />

        <div className="flex-1 min-w-0">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-brand-navy">{heading}</h1>
            <p className="mt-1 text-sm text-neutral-600">
              {activeMode === "goal" ? (
                <>
                  Every goal in Leadership Academy has to land across all three lenses — how it
                  changes <em>you</em>, the people <em>around</em> you, and the{" "}
                  <em>organization</em>. Your thought partner will help you get there.
                </>
              ) : target ? (
                <>
                  Continuing your conversation — your thought partner remembers where you left off.
                </>
              ) : (
                <>
                  Talk through anything — a situation at work, something you're noticing, a
                  half-formed goal. Your thought partner knows your active goals and recent
                  reflections.
                </>
              )}
            </p>
          </div>

          <CoachChat
            key={target?.id ?? "new"}
            mode={activeMode}
            goalContext={activeLens ? { primaryLens: activeLens } : undefined}
            initialConversationId={target?.id}
            initialMessages={initialMessages}
            emptyHint={
              activeMode === "goal" ? (
                <p>
                  Start by telling your thought partner what you want to grow in
                  {lensLabel ? ` — starting from ${lensLabel.toLowerCase()} is fine` : ""}. They'll
                  help you see how it lights up the other two lenses too.
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
      </div>
    </div>
  );
}

function pickLens(contextRef: Record<string, unknown>): Lens | undefined {
  const v = contextRef.primaryLens;
  return v === "self" || v === "others" || v === "org" ? v : undefined;
}

function lensLabelFor(lens: Lens | undefined): string | null {
  if (!lens) return null;
  return lens === "self"
    ? "Leading Self"
    : lens === "others"
      ? "Leading Others"
      : "Leading the Organization";
}

function headingFor(mode: Mode, lensLabel: string | null, title: string | null): string {
  if (title) return title;
  if (mode === "goal") {
    return lensLabel ? `Draft a goal — starting from ${lensLabel}` : "Draft a goal";
  }
  if (mode === "reflection") return "Reflect with your thought partner";
  if (mode === "assessment") return "Debrief your assessment";
  if (mode === "capstone") return "Shape your capstone story";
  if (mode === "intake") return "Getting to know you";
  return "Thought Partner";
}
