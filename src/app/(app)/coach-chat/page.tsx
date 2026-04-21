import type { UIMessage } from "ai";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachChat } from "@/components/chat/coach-chat";
import { ConversationsSidebar } from "@/components/chat/conversations-sidebar";
import { AccentWord } from "@/components/design/accent-word";
import { listConversations } from "@/lib/ai/conversation/list-conversations";
import { loadConversation } from "@/lib/ai/conversation/load-conversation";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { createSeededCoachPartnerConversation } from "@/lib/coach-partner/start-session";
import { assembleDashboardData } from "@/lib/dashboard/assemble";
import { createClient } from "@/lib/supabase/server";
import { createSeededThoughtPartnerConversation } from "@/lib/thought-partner/start-session";

export const metadata: Metadata = { title: "Thought Partner — Leadership Academy" };

const AUTO_RESUME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Mode =
  | "general"
  | "goal"
  | "reflection"
  | "assessment"
  | "capstone"
  | "intake"
  | "debrief"
  | "coach_partner";
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

  const roleCtx = await getUserRoleContext(supabase, user.id);
  const isCoachPrimary = roleCtx.coachPrimary;

  const allConversations = await listConversations(supabase, user.id);
  // Coach-primary users only see coach_partner conversations in the sidebar.
  // The learner-facing modes are irrelevant to them.
  const conversations = isCoachPrimary
    ? allConversations.filter((c) => c.mode === "coach_partner")
    : allConversations.filter((c) => c.mode !== "coach_partner");

  const requestedMode: Mode =
    sp.mode === "goal" ||
    sp.mode === "reflection" ||
    sp.mode === "assessment" ||
    sp.mode === "capstone" ||
    sp.mode === "intake" ||
    sp.mode === "debrief" ||
    sp.mode === "coach_partner"
      ? (sp.mode as Mode)
      : "general";
  const requestedLens: Lens | undefined =
    sp.lens === "self" || sp.lens === "others" || sp.lens === "org" ? sp.lens : undefined;

  const explicitNew = sp.new === "1" || sp.mode != null || sp.lens != null;

  // Resolve target conversation.
  let target = sp.c ? await loadConversation(supabase, sp.c) : null;

  // If the URL pointed at a specific conversation but it's gone (deleted or
  // access revoked), don't silently seed a replacement — that races with the
  // client's own router.push("/coach-chat/new") after a deletion and would
  // create two identical seeded openers in place of the one deleted chat.
  // Send the user to a clean URL instead and let the landing flow decide.
  if (sp.c && !target) {
    redirect("/coach-chat");
  }

  if (!target && !sp.c && !explicitNew && conversations.length > 0) {
    const mostRecent = conversations[0];
    const anchor = mostRecent.lastMessageAt ?? mostRecent.createdAt;
    if (Date.now() - new Date(anchor).getTime() < AUTO_RESUME_MAX_AGE_MS) {
      target = await loadConversation(supabase, mostRecent.id);
    }
  }

  // No target = the learner is about to land on a blank canvas. Seed a new
  // conversation with an opening assistant message so they never stare at an
  // empty chat with nothing to react to. Mirrors the pattern used by intake,
  // capstone, assessment-debrief, and from-nudge. Skipped only when the
  // learner isn't attached to an org (super-admin staff, unassigned
  // newcomers) — we can't insert an ai_conversations row without org_id.
  // Modes that have their own dedicated entry server actions (intake /
  // capstone / assessment) still bypass this via their own flows; if a
  // learner somehow arrives here with mode=intake/assessment/capstone in
  // the URL, we fall back to a plain blank render rather than silently
  // double-seeding.
  let seedMisfire = false;
  if (!target) {
    // Coach-primary users get a caseload-level coach_partner seed when they
    // land on /coach-chat without a target. Phase 2: we only seed caseload
    // here — learner-scoped prep is triggered by the server action from the
    // learner detail page.
    if (isCoachPrimary) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (membership?.org_id) {
        const conversationId = await createSeededCoachPartnerConversation({
          supabase,
          coachUserId: user.id,
          orgId: membership.org_id,
        });
        if (conversationId) {
          redirect(`/coach-chat?c=${conversationId}`);
        }
        seedMisfire = true;
      }
    } else {
      const seedableMode =
        requestedMode === "general" || requestedMode === "goal" || requestedMode === "reflection";
      if (seedableMode) {
        const { data: membership } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (membership?.org_id) {
          const conversationId = await createSeededThoughtPartnerConversation({
            supabase,
            userId: user.id,
            orgId: membership.org_id,
            mode: requestedMode,
            lens: requestedLens,
          });
          if (conversationId) {
            redirect(`/coach-chat?c=${conversationId}`);
          }
          // Seeding failed (DB error, LLM timeout, etc). Render a visible
          // notice so the learner isn't left staring at a blank chat
          // wondering what happened. They can still send a message — the
          // chat route creates the conversation on demand as a fallback.
          seedMisfire = true;
        }
      }
    }
  }

  // The active mode comes from a resumed conversation if present, otherwise
  // from the query param.
  const activeMode: Mode = target
    ? target.mode === "goal" ||
      target.mode === "reflection" ||
      target.mode === "assessment" ||
      target.mode === "capstone" ||
      target.mode === "intake" ||
      target.mode === "debrief" ||
      target.mode === "coach_partner"
      ? (target.mode as Mode)
      : "general"
    : requestedMode;
  const activeLens: Lens | undefined = target ? pickLens(target.contextRef) : requestedLens;

  const lensLabel = lensLabelFor(activeLens);
  const heading = headingFor(activeMode, lensLabel, target?.title ?? null);

  // How long has it been since the last message? Used to vary the resumption
  // subheading so a 30-day-old conversation doesn't say "continuing" like a
  // 5-minute-old one — a stale resume should feel intentional.
  const resumeAgeDays =
    target && (target.lastMessageAt ?? target.createdAt)
      ? Math.floor(
          (Date.now() - new Date(target.lastMessageAt ?? target.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  const initialMessages: UIMessage[] | undefined = target
    ? (target.messages as unknown as UIMessage[])
    : undefined;

  // Build the "Grounded in" list for the active thread. For a resumed
  // thread we read from a snapshot of the learner's current state so
  // the list reflects what the TP actually has on this turn — it's a
  // live read, not the thread's historical context. A follow-up can
  // swap this for the conversation's own `context_ref` payload.
  const data = isCoachPrimary ? null : await assembleDashboardData(supabase, user.id);
  const groundedIn = buildGroundedIn(data, activeMode, !!target);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row lg:px-9 lg:py-8">
      <ConversationsSidebar
        conversations={conversations}
        activeId={target?.id ?? null}
        activeTitle={heading}
        activeMode={activeMode}
        groundedIn={groundedIn}
      />

      <section
        className="flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden"
        style={{
          background: "var(--t-paper)",
          border: "1px solid var(--t-rule)",
          borderRadius: "var(--t-radius-lg)",
          boxShadow: "var(--t-panel-shadow)",
        }}
      >
        {/* Thread header — mono eyebrow + serif title. The serif here
            echoes the "THIS THREAD" block in the rail; on narrow
            viewports the rail collapses and this becomes the only
            place the learner sees the thread's title. */}
        <header
          className="px-6 py-5 lg:px-16"
          style={{ borderBottom: "1px solid var(--t-rule)" }}
        >
          <div className="mx-auto max-w-[720px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              {activeMode === "goal"
                ? "Drafting a goal"
                : activeMode === "reflection"
                  ? "Reflecting"
                  : activeMode === "assessment"
                    ? "Assessment debrief"
                    : activeMode === "capstone"
                      ? "Capstone"
                      : activeMode === "intake"
                        ? "Getting to know you"
                        : activeMode === "debrief"
                          ? "Course debrief"
                          : activeMode === "coach_partner"
                            ? "Coach Thought Partner"
                            : "Thought Partner"}
              {lensLabel ? ` · ${lensLabel}` : ""}
            </p>
            <h1
              className="mt-2 leading-[1.15] text-ink"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(22px, 2.4vw, 28px)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
              }}
            >
              {heading}
            </h1>
            <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
              {activeMode === "goal" ? (
                <>
                  Every goal here has to land across all three lenses — how it
                  changes <AccentWord>you</AccentWord>, the people around you,
                  and the organization. Your thought partner will help you get there.
                </>
              ) : target ? (
                <>{resumeSubheading(resumeAgeDays)}</>
              ) : (
                <>
                  Talk through anything — a situation at work, something you're
                  noticing, a half-formed goal. Your thought partner knows your
                  goals and recent reflections.
                </>
              )}
            </p>
          </div>
        </header>

        {seedMisfire && (
          <div
            role="status"
            className="px-6 py-3 text-[12px] lg:px-16"
            style={{
              borderBottom: "1px solid var(--t-rule)",
              background: "var(--t-accent-soft)",
              color: "var(--t-ink)",
            }}
          >
            <div className="mx-auto max-w-[720px]">
              <p className="font-medium">Couldn't draft an opener just now.</p>
              <p className="mt-0.5 text-ink-soft">
                Send your first message — your thought partner will pick up from there.
              </p>
            </div>
          </div>
        )}

        <CoachChat
          key={target?.id ?? "new"}
          mode={activeMode}
          goalContext={activeLens ? { primaryLens: activeLens } : undefined}
          initialConversationId={target?.id}
          initialMessages={initialMessages}
          emptyHint={
            activeMode === "goal" ? (
              <p>
                Tell your thought partner what you're trying to grow into as a leader
                {lensLabel ? ` — starting from ${lensLabel.toLowerCase()} is fine` : ""}. They'll
                help you shape it into a goal that actually moves things.
              </p>
            ) : undefined
          }
        />
      </section>
    </div>
  );
}

// Derive the "Grounded in" list for the rail. Keeps the same spirit as
// the dashboard TP-hero transparency sources but renders as short
// one-liners (the rail has less room than the modal). For coach_partner
// mode we return an empty list — the coach's context is different and
// lives inside `buildCoachContext`; phase 7 can wire this up.
function buildGroundedIn(
  data: Awaited<ReturnType<typeof assembleDashboardData>> | null,
  mode: Mode,
  isResumed: boolean,
): string[] {
  if (mode === "coach_partner") return [];
  if (!data) return [];
  const out: string[] = [];
  if (data.activeSprint) {
    out.push(`${data.activeSprint.actionCount} sprint actions, last ${data.activeSprint.day} days`);
  }
  if (data.recentReflection) {
    const days = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(data.recentReflection.created_at).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    out.push(days <= 1 ? "Your most recent reflection" : `Reflection from ${days} days ago`);
  }
  if (data.lastRecapAt) {
    out.push("Last recap with your coach");
  }
  if (data.memoryFacts.length > 0) {
    out.push(`${data.memoryFacts.length} memory ${data.memoryFacts.length === 1 ? "fact" : "facts"}`);
  }
  if (data.activeSprint?.goal) {
    out.push(`Goal: ${data.activeSprint.goal.title}`);
  }
  if (!isResumed && out.length === 0) {
    out.push("Your profile and most-recent activity");
  }
  return out.slice(0, 5);
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

function resumeSubheading(ageDays: number | null): string {
  if (ageDays == null || ageDays < 1) {
    return "Picking up where you left off — your thought partner remembers everything above.";
  }
  if (ageDays === 1) {
    return "Picking up from yesterday — your thought partner remembers everything above.";
  }
  if (ageDays < 7) {
    return `Picking up from ${ageDays} days ago — scroll up if you want a refresher on what you were working through.`;
  }
  if (ageDays < 21) {
    return "It's been a couple of weeks — scroll up to see what you were working through, or jump in fresh and your thought partner will catch up.";
  }
  return "It's been a while since this conversation. Scroll up for context, or start a new conversation if today's thought is its own thing.";
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
  if (mode === "coach_partner") return "Coach Thought Partner";
  return "Thought Partner";
}
