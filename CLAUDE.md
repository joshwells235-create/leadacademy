@AGENTS.md

# Leadership Academy — CLAUDE.md

## What this is

**Leadership Academy** (product name, user-facing) — a leadership development platform built by LeadShift.
Internally called `leadacademy` (repo name, package name, folder) — treat this as a dev shorthand only.
Never surface "LeadAcademy" in user-visible strings.

Combines a deeply-context-aware AI **thought partner** (Claude) with structured learning
(courses/modules/lessons), assessment ingestion (PI, EQ-i, 360), integrative goal-setting with
sprints, reflections, daily challenges, community, messaging, long-term memory, proactive
check-ins, and coach/admin/consultant portals — all in one multi-tenant app.

**Naming — important.** User-facing, the AI chatbot is **"Thought Partner"**. The word "coach" in
the UI refers to the learner's human **executive coach**. Internally many routes (`/coach-chat`),
DB tables (`coach_nudges`, `coach_notes`, `coach_assignments`), and helpers (`is_coach_of`) still
say "coach" — those pre-date the rename and refer to either the AI chat surface or the human coach
role; don't rename code without a reason. When writing new user-visible strings, always say
"thought partner" for the AI and "coach" only for the human role.

**Live:** https://leadacademy.vercel.app
**Repo:** https://github.com/joshwells235-create/leadacademy
**Supabase project:** `vcpuxpbncltyihnfnaim` in Leadshift org (`zuvrkjogtldbfqbpspkw`), us-east-2

## Tech stack

- **Framework:** Next.js 16 App Router (Turbopack), React 19, TypeScript
- **Styling:** Tailwind v4 with custom brand tokens in `globals.css`
- **Database / Auth / Storage / Realtime:** Supabase (Postgres 17)
- **AI:** Claude via `@anthropic-ai/sdk` + Vercel AI SDK `ai` / `@ai-sdk/anthropic` / `@ai-sdk/react`. Server-side only — **never expose AI keys in the browser**
- **Rich text:** Tiptap (editor for course lessons, server-side HTML rendering for learners)
- **Package manager:** pnpm 10
- **Lint:** Biome (not ESLint)
- **Error tracking:** Sentry (`@sentry/nextjs`, activated via `NEXT_PUBLIC_SENTRY_DSN` env var)
- **Evals:** YAML fixtures in `evals/fixtures/`, runner + Opus judge in `evals/`, `pnpm eval`

## Key conventions

- **Next 16 note:** `middleware.ts` was renamed to `proxy.ts` exporting a `proxy()` function
- **Git:** Commits use `josh@leadshift.com` / "Josh Wells" passed per-command via `git -c` (never set global config)
- **Types:** `src/lib/types/database.ts` is generated from Supabase. Use the MCP tool `generate_typescript_types` with project ID `vcpuxpbncltyihnfnaim`, then update the file. Tables are in alphabetical order.
- **Server actions** follow a consistent pattern: Zod validation -> `createClient()` -> auth check -> membership/org_id lookup -> insert/update -> `revalidatePath` -> return `{ok}` or `{error}`
- **RLS:** Every table uses Row Level Security. Helper functions in Postgres: `is_super_admin()`, `is_org_member(org_id)`, `is_org_admin(org_id)`, `is_coach_in_org(org_id)`, `is_coach_of(learner_id)`, `is_consultant_in_org(org_id)`, `is_consultant_of_cohort(cohort_id)`, `is_consultant_of_learner(learner_id)` (the consultant helpers resolve via `coalesce(memberships.consultant_user_id, cohorts.consultant_user_id)` so per-learner overrides take precedence over the cohort default).
- **AI calls:** Always server-side via `/api/ai/*` routes. Key never in browser. Every conversation persisted to `ai_conversations` + `ai_messages`. Usage tracked in `ai_usage`.
- **Seeded openers for new conversations.** Mode-switching CTAs (intake, capstone, assessment debrief, from-nudge) go through a server action that creates the conversation, seeds the thought partner's first message, and redirects to `/coach-chat?c=<id>`. Never drop the learner on a blank canvas for these flows — if you add a new mode, seed an opener.
- **AI-mode check constraint.** `ai_conversations.mode` has a CHECK constraint listing the allowed modes. **When adding a new mode, update the constraint in the DB alongside the TypeScript enum / Zod schema / runner map** — otherwise inserts fail silently and the fallback redirect lands the user on a blank chat. Current modes: `general | goal | reflection | assessment | capstone | intake`.
- **Today's date goes into every learner context.** `LearnerContext.today = { iso, weekday }` is populated in `assembleLearnerContext` from `new Date()` and rendered as the first line of the identity block: `Today: 2026-04-19 (Sunday). Use this when choosing any date — never pick a date before today.` Without this, the model hallucinates past target dates when doing "X days from now" math. Every mode inherits it since they share the context assembler.
- **Sanitize dangling tool parts before convertToModelMessages.** The chat route runs `sanitizeDanglingToolParts(messages)` which strips `tool-*` parts from assistant messages that aren't in `output-available` / `output-error` state. This handles the case where a learner types a new message instead of clicking an approval pill — without the sanitizer, Anthropic rejects the next turn with "tool_use_id X is not followed by tool_result blocks" and the conversation gets stuck. Don't remove this without replacing it.
- **Backstop date validation in the handlers.** `finalize_goal` and `start_goal_sprint` return an error if `target_date` / `planned_end_date` is before today. The tool-use ecosystem is resilient: a rejected tool call shows the AI the error, and it re-proposes with a corrected date.
- **Nudge detectors gate by artifact age.** Any "it's been quiet for N days" detector (`goal_check_in`, `sprint_quiet`) must require the underlying artifact to have existed for at least that many days. Otherwise a brand-new goal/sprint trivially satisfies "no action in N days" and the nudge fires seconds after creation. The existing detectors use `.lte("created_at", cutoff)` on the source table.
- **Migrations via MCP.** Most schema changes are applied directly via `mcp__…__apply_migration` rather than tracked as files under `supabase/migrations/`. The one pre-existing `.sql` file is the foundations migration; everything since lives only in Supabase's migration history. Take this into account if replicating in a local / preview environment.
- **No cron infrastructure.** Async work (memory distillation, nudge detection, title generation, assessment rollup synthesis) runs fire-and-forget inside the request that naturally triggers it.
- **PostgREST embed queries require explicit FKs.** `supabase.from("X").select("profiles:user_id(display_name)")` only resolves if there's a foreign key from `X.user_id → profiles.user_id`. `auth.users.id` isn't enough — the FK must be direct to `profiles`. The `add_user_fks_to_profiles` migration wired these up for `memberships`, `coach_assignments`, `session_recaps`, `action_items`, and `cohorts.consultant_user_id`. Without the FK, the embed silently returns null and the page falls back to `[]` — a nasty silent-failure mode. If you add a new `*_user_id` column that needs profile embeds, add the FK in the same migration.
- **Shared admin UI primitives live at `src/components/ui/` and `src/lib/admin/`.** `ConfirmBlock` (confirm-dialog.tsx) is the house pattern for destructive / caution / restorative actions — never use browser `confirm()` in admin surfaces. `ROLE_LABEL` / `ROLE_DESCRIPTION` / `ROLE_BADGE_CLASS` in `lib/admin/roles.ts` are the single source of truth for displaying role names; raw DB role strings (`org_admin`, `learner`, etc.) should not appear in the UI.
- **Don't trigger state updates in the onClick of a submit button inside a conditionally-rendered form.** If `{open && <form action={serverAction}><button onClick={() => setOpen(false)}>Submit</button></form>}`, clicking the button fires `setOpen(false)` synchronously → React unmounts the form → the browser never submits. This bit sign-out twice (mobile + desktop dropdowns). The fix: let the server action's `redirect()` unmount the tree; don't close the menu in the onClick.
- **Invite-consumption is email-confirmation-gated.** `registerAction` only calls `consume_invitation` when `supabase.auth.getUser().email_confirmed_at` is truthy — otherwise the Supabase SDK can surface the user object from the in-memory signUp result without a real session cookie, and the RPC fails with "invitation invalid" because `auth.uid()` resolves to null inside the SECURITY DEFINER function. When confirmation is needed, fall through to the "check your email" branch and let `/auth/consume` handle the consume step after the link is clicked.
- **Email delivery in production requires custom SMTP.** Supabase's built-in email sender is development-only even on Pro tier (rate-limited at ~30/hour). Configure custom SMTP (Resend / SendGrid / Postmark) in Supabase Dashboard → Auth → SMTP Settings before any real invite batch. The `manuallyAddMember` action exists as an escape hatch when SMTP is down: creates a confirmed user directly with a temp password, bypasses the email flow entirely.
- **Supabase auth redirect allowlist must include `/auth/callback` wildcards.** Redirect URLs (dashboard) must include `https://leadacademy.vercel.app/**` (and the localhost equivalent). Without the wildcard, Supabase rejects the session exchange with an `invalid_grant`-style error when `?next=...` query strings are present.
- **Super-admin actions log as `super.*` in activity_logs.** Every mutating action in `src/lib/super/*-actions.ts` goes through `requireSuperAdmin` + emits an activity log (`super.org.*`, `super.cohort.*`, `super.user.*`, `super.membership.*`, `super.artifact.*`, `super.resource.*`, `super.announcement.*`, `super.ai.*`, `super.invitation.*`, `super.post.deleted`, `super.comment.deleted`). The `/super/activity` view knows how to humanize all of these — when adding a new super action, extend the `ACTION_LABEL` map in `super/activity/activity-view.tsx`.
- **Soft-delete is the super-admin user-deletion pattern.** `profiles.deleted_at` is set via `softDeleteUser`; memberships are archived and sessions revoked in the same action. `loginAction` (in `lib/auth/actions.ts`) checks `deleted_at` after successful auth and signs the user back out with a neutral "account deactivated" message — don't bypass this.
- **AI errors should be logged, not silently swallowed.** Any catch block around a `generateText` / `generateObject` / streaming call should call `logAiError({ feature, error, model, ... })` from `@/lib/ai/errors/log-error` before returning. The viewer at `/super/ai-errors` depends on these. `logAiError` is self-swallowing — it never throws back into the caller.
- **Announcements consumption is per-user-dismissible.** Resolve via `getVisibleAnnouncements(supabase, userId)` from the dashboard (already wired). When adding a new surface that should show banners, import the helper and render `<AnnouncementBanner>` above the main content. Dismissals land in `announcement_dismissals (user_id, announcement_id)`.

## Brand

Colors defined as Tailwind theme tokens in `src/app/globals.css`:
- `brand-navy: #101d51` — nav background, primary headings, body text
- `brand-light: #f3f3f3` — page backgrounds
- `brand-pink: #EA0C67` — accent, destructive actions, Thought Partner nav link
- `brand-blue: #007efa` — CTAs, buttons, links, focus rings
- `brand-blue-dark: #0066cc` — button hover states

Logo: `public/leadshift-logo.svg` (full wordmark), `public/icon.svg` (icon mark for favicon)

**All page headings:** `text-2xl font-bold text-brand-navy` (or `text-3xl` for dashboard)
**All buttons:** `bg-brand-blue ... hover:bg-brand-blue-dark`
**All links:** `text-brand-blue`

## Roles

- `super_admin` (LeadShift staff): builds courses/resources, manages all orgs, full access everywhere
- `org_admin` (client L&D lead): invites learners, assigns coaches, monitors progress. Cannot build content.
- `consultant` (LeadShift staff, per-cohort): owns program delivery for a cohort — facilitates peer groups, runs workshops, organizes logistics. Read access across learner data in cohorts they consult on; can invite learners, assign coaches, create/edit cohorts in orgs where they consult.
- `coach`: coaches assigned learners, writes notes/recaps/action items
- `learner`: the participant

**Consultant assignment model.** A cohort has a default consultant on `cohorts.consultant_user_id`. For edge cases (e.g. the Open Leadership Academy where one cohort spans multiple client orgs), individual learners can override via `memberships.consultant_user_id`. Every active learner has exactly one effective consultant: `coalesce(membership.consultant_user_id, cohort.consultant_user_id)`.

## Product decisions (locked)

- **Multi-tenant** from day one. `organizations` -> `cohorts` -> users via `memberships`. Every user-scoped table has `org_id`.
- **Three lenses, not three silos.** Goals are integrative — `impact_self`, `impact_others`, `impact_org` are all NOT NULL. `primary_lens` is optional metadata about where the learner started, not a silo.
- **Goals are program-long; sprints make them practicable.** A goal like "stop being the safety net" is the long aspiration. Sprints (`goal_sprints`) are 4-8 week practice windows with a specific behavior and a visible action count — that's what makes progress feelable. A goal has many sprints, at most one active.
- **LeadShift creates all content.** Courses/modules/lessons/resources have no `org_id` — they're global catalog. Assigned to cohorts via `cohort_courses`.
- **Unified AI thought partner** with swappable modes (`general`, `goal`, `reflection`, `assessment`, `capstone`, `intake`). Prompts in `src/lib/ai/prompts/`.
- **Invite-only signup.** No public registration. Org admins send invite tokens.
- **Models:** Sonnet 4.6 for chat + synthesis; Opus 4.6 for heavy judgment (eval judge); Haiku 4.5 for cheap labeling (conversation titles).
- **Assessments are tendencies, not diagnoses.** PI findings are rendered with "tends toward" language, not "is X". EQ-i and 360 use direct language. Participants no longer see raw extraction on `/assessments` — they see a "Ready" state and debrief with the thought partner.
- **Proactive check-ins are opt-in-by-default but learner-controllable.** The thought partner can reach out with up to 2 messages/week (global cap) + 14-day per-pattern cooldown. Opt-out toggle at `/memory`.
- **Intake gathers "About this leader" before anything else.** First-time learners hit a dashboard CTA that starts a conversational intake (new `intake` mode, 9 structured fields saved via the `update_profile_context` tool). The seeded opener greets them, frames why intake matters, and asks question 1 so they never land on a blank canvas. Fields live on `profiles` (role_title, function_area, team_size, total_org_influence, tenure_at_org, tenure_in_leadership, company_size, industry, context_notes). Injected as an "About this leader" block at the top of every turn's learner context from then on.
- **Capstone is story-synthesis, not deck-building.** The capstone builder (`/capstone`, unlocked per-cohort via `cohorts.capstone_unlocks_at`) helps learners synthesize their 9-month journey into a five-beat arc (Before → Catalyst → Shift → Evidence → What's Next). The thought partner surfaces moments from the learner's real data; the learner still owns writing and delivering the presentation. One `capstone_outlines` row per learner.

## The thought-partner product (the core)

Everything below is the AI thought-partner loop. Most production value lives here.

### Context assembled on every chat turn (`src/lib/ai/context/`)

One canonical learner context is built on every turn from the real DB — shared across modes, callers, and the proactive-nudge opener generator. Sections:
- Identity + membership + **today's date** (so the model never has to guess)
- **About this leader** (profile intake fields — role, team, company, tenure, free-text context; absent when intake hasn't happened yet)
- All uploaded assessment summaries, PLUS combined-themes synthesis when ≥2 reports are present
- Active goals with per-goal action count, days since last action, **current sprint** block (title, practice, day X of Y, action_count_this_sprint), **sprint history** summary
- Recent action logs (last 15, with linked goal title)
- Recent reflections (last 30, with themes)
- Most recent coach session recap
- Open coach-assigned action items + most recent completed
- Current course progress (lesson title, % complete)
- Today's daily challenge + 7-day completion count
- Top 15 long-term memory facts (grouped by type)

### Conversations have continuity (`src/lib/ai/conversation/`)

- `ai_conversations` + `ai_messages` store the full persistent transcript (user AND assistant messages, content parts preserved)
- Auto-generated titles via Haiku after the first exchange
- `/coach-chat` auto-resumes the most recent conversation ≤30 days old; sidebar lists all priors grouped Today / This week / Earlier
- Rename, delete, and per-conversation mode stickiness
- Tool-part replay works for resumed transcripts (approval pills on old turns render as "no longer actionable")

### Tools the thought partner can call (`src/lib/ai/tools/`)

The thought partner doesn't just talk — it acts. Registered in the chat route.

| Tool | Needs approval | What it does |
|---|---|---|
| `log_action` | No (auto) | Logs a behavioral action to the learner's action log |
| `create_reflection` | No (auto) | Saves a substantive reflection paragraph with themes |
| `tag_themes` | No (silent) | Updates theme tags on an existing reflection |
| `suggest_lesson` | No (read) | Cohort-scoped lesson search, rendered as cards |
| `suggest_resource` | No (read) | Library search, rendered as cards |
| `update_profile_context` | No (auto, inline "saved" card) | Save intake-gathered profile fields + stamp `intake_completed_at` |
| `finalize_goal` | Yes | Saves an integrative three-lens SMART goal |
| `update_goal_status` | Yes | Completes / archives / reopens a goal |
| `set_daily_challenge` | Yes | Sets today's or tomorrow's daily challenge (upserts, flags collision) |
| `start_goal_sprint` | Yes | Starts a sprint on a goal (title + specific practice + end date); closes any active sprint first |
| `refine_capstone_section` | Yes | Merges one refined section (Before / Catalyst / Shift / Evidence / What's Next) into `capstone_outlines.outline` |

Tool renderers live in `src/components/chat/tool-renderers/` with a registry-based dispatch. Approval pills use the shared `ApprovalPill` component.

### Long-term memory (`src/lib/ai/memory/`)

- `learner_memory` table stores durable facts about the learner distilled from conversations
- Types: `preference | pattern | commitment | relational_context | stylistic | other`
- Distillation runs fire-and-forget when a NEW conversation starts — scans for prior conversations idle ≥2h with ≥4 messages, up to 5 per trigger. Sonnet returns structured ops (new / update / confirm). User-edited facts are never overwritten.
- `/memory` page lets the learner view / edit / delete facts and add their own. Also hosts the proactivity toggle.

### Proactive coaching (`src/lib/ai/nudges/`)

- `coach_nudges` table records one row per fired nudge; linked to `notifications` row for delivery
- Detector runs inline on dashboard visits (skips first-time users). One nudge per check, first match wins. Respects `profiles.proactivity_enabled`.
- Rate limits: **2 nudges / rolling 7 days** (global cap, dismissal still counts), per-pattern cooldown (default 14 days).
- 9 patterns, in priority order: `sprint_ending_soon`, `sprint_needs_review`, `challenge_followup`, `undebriefed_assessment`, `sprint_quiet`, `reflection_streak_broken`, `new_course_waiting`, `momentum_surge`, `goal_check_in`
- **Artifact-age gates.** "Quiet" detectors (`goal_check_in`, `sprint_quiet`) require the underlying goal/sprint to be at least as old as the lookback window — otherwise they'd trivially fire on brand-new artifacts. `goal_check_in` needs goal created ≥45 days ago; `sprint_quiet` needs sprint created ≥10 days ago.
- Clicking a nudge card routes to `/coach-chat/from-nudge/[id]` which generates a rich Sonnet opener grounded in pattern data + full learner context, seeds a new conversation, marks nudge as acted, redirects into `/coach-chat?c=<id>`
- Dismiss action sets `dismissed_at` (counts toward cap — can't dismiss to refill)

### Assessment debrief

- `/assessments` no longer shows rendered per-report summaries — just a "Ready" state once processed
- "Debrief with thought partner" button calls `startAssessmentDebrief` server action which creates a conversation with a proactive Sonnet-generated opener grounded in the learner's full context (including combined themes)
- Extraction prompt is per-type: PI forbids absolute language (requires "tends toward...", "can lean toward..."); EQ-i and 360 keep direct language
- Combined-themes synthesis runs on rollup when ≥2 reports are ready, stored as `assessments.ai_summary._combined_themes`

### Intake (`src/lib/intake/`, `src/lib/ai/prompts/modes/intake.ts`)

- Dashboard surfaces a "Tell your thought partner about yourself" CTA whenever `profiles.intake_completed_at` is null and the learner has a membership
- Clicking the CTA calls `startIntakeSession()` — creates an `intake`-mode conversation, seeds a deterministic opener (greeting + first question) so the chat is never blank, redirects to `/coach-chat?c=<id>`. If a recent intake conversation exists (≤30d) it resumes that instead
- Intake mode walks nine fields one at a time, saving each via `update_profile_context`. The ninth field (`context_notes`) is open-ended "what else should I know" — often the most useful. Setting `mark_complete: true` stamps `intake_completed_at` and the thought partner transitions into general-style chat within the same conversation
- `/profile` is the editable form view; saving the form also stamps `intake_completed_at`. Includes a "walk through it conversationally" button that re-opens intake
- Persona tweak: when the "About this leader" section is absent and we're NOT in intake mode, the thought partner weaves basics into natural conversation rather than interrogating — never blocks help on profile being incomplete

### Capstone (`src/lib/capstone/`, `src/lib/ai/prompts/modes/capstone.ts`)

- Unlocks per-cohort via `cohorts.capstone_unlocks_at` (set by super_admin on `/super/orgs/[id]`). Before the date, `/capstone` shows a locked state; after, the builder is live
- "Generate story outline" button (`startCapstoneSession`) creates a `capstone`-mode conversation with a Sonnet-generated opener that drafts a first-pass arc grounded in goals + sprints + reflections + assessments
- `capstone` mode walks the learner through Before → Catalyst → Shift → Evidence → What's Next one beat at a time. `refine_capstone_section` (approval-gated) merges each refined section into `capstone_outlines.outline` (JSONB: sections + moments + pull_quotes)
- Lifecycle: `draft` → `shared` → `finalized`. "Share with coach" makes it visible to the human coach on their learner-view panel. Coach / consultant / admin all see a read-only `CapstoneReadonly` panel; in draft they see only status + section count (the learner's draft is private until they share)

### Evals (`evals/`)

- 28 YAML fixtures in `evals/fixtures/` across 7 categories: context_grounding, tool_triggering, tool_restraint, tone_language, mode_boundaries, anti_patterns, sprint_coaching, plus capstone-mode fixtures
- Runner reconstructs the real system prompt (same PERSONA + mode + context formatter) with mock tool handlers that record calls
- Opus judge via `generateObject`, one pass/fail verdict per criterion with reasoning
- Baseline stored at `evals/baseline.json`; `pnpm eval` diffs against it and exits nonzero on regression
- Flags: `--update` (save new baseline), `--filter <name>`, `--verbose`

## Database tables

Identity: `organizations`, `profiles`, `memberships`, `cohorts`, `coach_assignments`, `invitations`
Coaching: `goals`, `goal_sprints`, `action_logs`, `reflections`, `daily_challenges`, `assessments`, `assessment_documents`, `capstone_outlines`
AI: `ai_conversations`, `ai_messages`, `ai_usage`, `ai_errors`, `learner_memory`, `coach_nudges`
Coach tools: `pre_session_notes`, `coach_notes`, `session_recaps`, `action_items`
Learning: `courses`, `modules`, `lessons`, `cohort_courses`, `lesson_progress`
Social: `community_posts`, `community_likes`, `community_comments`, `threads`, `thread_participants`, `messages`, `notifications`
Resources: `resources`
Announcements: `announcements`, `announcement_dismissals`
Audit: `activity_logs`

Key cross-references:
- `action_logs.sprint_id` — FK to `goal_sprints`. DB trigger `bump_sprint_action_count` keeps `goal_sprints.action_count` honest. New action inserts stamp the goal's active sprint; historical rows stay null.
- `goal_sprints` partial unique index on `(goal_id) WHERE status = 'active'` — at most one active per goal.
- `ai_conversations.distilled_at` — set when memory extraction has processed the conversation.
- `ai_conversations.title` — auto-filled by Haiku after first exchange.
- `ai_conversations.mode` — CHECK constraint whitelist; update it when adding a new mode (see Key conventions).
- `cohorts.consultant_user_id` — cohort-default consultant (nullable).
- `cohorts.capstone_unlocks_at` — date; before it, `/capstone` shows locked state. Super_admin sets it.
- `memberships.consultant_user_id` — per-learner consultant override (nullable, wins over cohort default).
- `capstone_outlines` — one row per learner; `outline` JSONB holds the five sections; `status` in (draft, shared, finalized); linked to an `ai_conversations` row via `conversation_id`.
- `profiles` intake fields: `role_title`, `function_area`, `team_size`, `total_org_influence`, `tenure_at_org`, `tenure_in_leadership`, `company_size`, `industry`, `context_notes`, `intake_completed_at`. Populated by the `update_profile_context` tool during intake mode or the `/profile` form directly.
- `goals.active_focus_until` — **deprecated**; no code reads or writes it. Dropped in a future migration.
- `profiles.proactivity_enabled` — per-learner master switch for nudges.
- `profiles.deleted_at` — super-admin soft-delete. When set: memberships are archived, sessions revoked, login blocked with "account deactivated" message. Restore by clearing.
- `announcements` — super-authored banners; `scope` in (`global`/`org`/`cohort`/`role`) with integrity check. `announcement_dismissals` is per-user. Resolved client-side via `getVisibleAnnouncements`.
- `ai_errors` — failed AI calls (feature, model, org, user, conversation, message). Writes go through `logAiError`; reads via RLS restricted to super_admin.

## Routes

### Learner
- `/dashboard` — intake CTA (when pending), proactive nudge card, daily challenge, coach items, goals overview, quick access, onboarding for first-time
- `/profile` — editable profile (role, team, company, tenure, context notes); "walk through it conversationally" re-opens intake mode
- `/goals`, `/goals/[id]` — goal detail with **sprint section** (active + history + start), SMART criteria, three-lens impacts, action log
- `/action-log` — logged actions grouped by day + form (stamps sprint_id)
- `/reflections` — journal with AI theme tagging + delete
- `/assessments` — upload PI/EQ-i/360 PDFs; "Debrief with thought partner" seeds proactive conversation
- `/capstone` — capstone builder (locked until `cohorts.capstone_unlocks_at`; entry state + workspace after unlock)
- `/learning`, `/learning/[courseId]`, `/learning/[courseId]/[lessonId]` — course progress + lesson viewer
- `/coach-chat` — streaming Claude, auto-resumes ≤30d, sidebar
- `/coach-chat/new` — explicit new conversation
- `/coach-chat?c=<id>` — resume specific
- `/coach-chat?mode=intake|goal|reflection|assessment|capstone` — start a typed conversation (usually reached via a server-action CTA that seeds an opener, not a bare link)
- `/coach-chat/from-nudge/[id]` — click handler for proactive nudges; generates opener + redirects
- `/memory` — what the thought partner remembers + proactivity toggle
- `/community` — two-tab feed (cohort + alumni)
- `/resources` — filterable card grid
- `/messages`, `/messages/[threadId]` — real-time DM with Supabase Realtime
- `/pre-session` — coaching session prep form

### Coach
- `/coach/dashboard` — searchable / filterable / sortable learner grid, per-card "what's new since your last recap" chips, sprint vitality, coaching-since date
- `/coach/learners/[id]` — top "since last recap" strip, prev/next nav (←/→ keyboard), sprint vitality on goals, thought-partner activity panel (read-only), AI-drafted session recap button, full action-item / notes / recap UI

### Consultant
- `/consultant/dashboard` — cohorts the user consults on (default OR override); per-cohort vitality chips (% active, active sprints, assessment coverage, no-coach flag); collapsible role explainer
- `/consultant/cohorts/[cohortId]` — cohort detail with at-a-glance vitality metrics, reflection themes strip, searchable/filterable roster, coaches panel with learner-count per coach + inline "Assign / change coach" control, cohort metadata editor (description + capstone unlock date)
- `/consultant/learners/[id]` — prev/next keyboard nav, "in the last 14 days" strip, sprint vitality, thought-partner activity panel, session-recap coach attribution, override badge when scope is via per-learner override

### Org Admin
- `/admin/dashboard` — 6-metric vitality grid (active members / learners / active 14d / no coach / intake pending / pending invites), cohorts-ending-soon card, per-cohort vitality table
- `/admin/people` — searchable + filterable + sortable members table (role / cohort / coach / at-risk flags / status), bulk select + sticky action bar (move cohort / assign coach / archive / unarchive), at-risk chips per row (No coach / Quiet 14d+ / Intake pending), inline cohort & coach pickers, role-change with in-UI confirm; invitations panel with pending/accepted/expired counts + Resend + Revoke; coach-load bar chart; three invite modes (single / bulk paste / manual-add-user)
- `/admin/cohorts` — cohort list with edit-in-place + archive (with "reassign N members first" guard); consultant-name pills
- `/admin/cohorts/[cohortId]` — cohort detail with full roster, multi-select bulk-move to another cohort, consultant label
- `/admin/activity` — audit log with actor / action / date-range filters, humanized action labels, CSV export

### Super Admin
- `/super/orgs` — cross-org dashboard (8-metric vitality grid) + searchable/sortable org cards with per-org vitality chips
- `/super/orgs/[id]` — org detail + settings + cohort panel (assign consultant, capstone unlock, create-cohort) + searchable members
- `/super/orgs/[id]/cohorts/[cohortId]` — cohort detail with vitality metrics, roster + chips, assigned courses, edit-metadata + archive
- `/super/orgs/[id]/members/[userId]` — cross-org learner deep-dive: 14d since-strip, profile, goals+sprints, actions, reflections, assessments, conversations, nudges, memory facts, coach notes / recaps / action items, capstone, consultant override, AI triggers
- `/super/orgs/[id]/assign-courses` — cohort-course assignment matrix
- `/super/users`, `/super/users/[userId]` — global user directory + full edit console (profile, email, password reset, email confirm, session revoke, super-admin toggle, role / cohort / org moves, soft-delete / restore)
- `/super/invitations` — cross-org invitation audit with scope / org filters + revoke
- `/super/course-builder`, `/super/course-builder/[id]`, `/super/course-builder/[id]/lessons/[id]` — Tiptap rich editor for courses (ConfirmBlock for course / module / lesson delete)
- `/super/resources` — resource library CRUD (the admin surface for /resources)
- `/super/announcements` — global / org / cohort / role-targeted banner broadcast
- `/super/ai-usage` — cross-org AI spend (7d / 30d / 90d / MTD / all) + org filter + daily sparkbar
- `/super/conversations`, `/super/conversations/[id]` — AI transcript viewer (renders AI-SDK parts, delete action)
- `/super/moderation` — community post / comment moderation (search / type / org / date filters)
- `/super/activity` — cross-org audit log (admin + super scopes) with filters + CSV export
- `/super/ai-errors` — failed AI calls / extraction errors / distillation errors, feature-grouped
- `/super/export` — CSV data export with live row counts per type

### Auth
- `/login`, `/register`, `/forgot-password`, `/reset-password`

## Phases completed

### Foundational build (phases 0-10)

0. Foundations (auth, schema, RLS, deploy)
1. Core coaching loop (Claude streaming, goals, action log)
2. Reflections + daily challenges
3. Assessment ingestion (PDF upload + extraction)
4. Coach-facing tools (pre-session, notes, recaps, action items)
5. Learning modules (Tiptap editor, courses, progress tracking)
6. Messages + notifications (Supabase Realtime)
7. Community (cohort + alumni feeds) + resource library
8. Admin portal (org_admin people/cohort management)
9. Super admin (orgs, AI usage, conversations, moderation, export)
10. Polish (login, metadata, errors, loading, a11y, Sentry, mobile nav)

### Coaching excellence rebuild

Each phase ended with sign-off + implementation, not just a writeup. See the phase descriptions above for details.

1. **Unified learner context** — one canonical context assembler shared across modes/callers.
2. **Conversation continuity** — persistence of full assistant content, Haiku titling, sidebar + resume, per-conversation mode lock.
3. **Tool use / agency** — 7 new tools + shared approval pill; retrofit `finalize_goal` with approval; generic renderer registry.
4. **Long-term memory** — `learner_memory` table, fire-and-forget distillation, `/memory` privacy UI.
4.5. **Assessment refinements** — PI tendency language, combined-themes synthesis, proactive debrief opener, removed per-report render from participant UI.
5. **Proactivity** — `coach_nudges` + 8 detectors + opener generation, dashboard card, opt-out toggle.
6. **Evals** — YAML fixtures, runner, Opus judge, baseline diff (`pnpm eval`).
7. **Goal rework with sprints** — `goal_sprints` table, `start_goal_sprint` tool, sprint section UI, per-sprint action stamping; retired `active_focus_until`; updated nudge patterns to sprint semantics.

### Expansion phases

1. **Capstone builder** — `capstone_outlines` table, `capstone` AI mode, `refine_capstone_section` tool, `/capstone` route with locked / entry / workspace states, per-cohort unlock date, read-only panels on coach/consultant/admin learner views, 2 eval fixtures.
2. **Consultant role** — new 5th role (LeadShift consultant) assigned per-cohort via `cohorts.consultant_user_id`, with per-learner override on `memberships.consultant_user_id` for mixed-org cohorts. Three RLS helpers, read policies across learner-data tables, write policies for coach assignments / invitations / cohorts in orgs they consult on. `/consultant/*` portal with dashboard + cohort + learner views.
3. **Thought Partner rename** — user-facing "Coach" → "Thought Partner" across UI, persona, all mode prompts, tool descriptions, nudge copy, memory page, capstone flow, super-admin conversation viewer, 26 eval fixtures + judge + runner. "Coach" retained for the human executive coach role and all internal code (routes, tables, helpers).
4. **Profile intake** — nine structured fields on `profiles` + an `intake` AI mode + `update_profile_context` tool + `/profile` editable form. Thought partner runs a conversational intake on first visit (seeded opener, no blank canvas), saving each field as discussed. "About this leader" block injected at the top of the learner context on every turn thereafter.

Plus: Leadership Academy branding sweep (all user-facing strings).

### UX polish sweep (Phases 1–6)

A portal-by-portal UX rebuild. Each phase: thorough audit → triage → three-batch implementation. Notable cross-cutting patterns:

- **Shared helpers**: `lib/coach/since-last-session.ts` (anchored on last recap), `lib/consultant/since-last-visit.ts` (rolling 14d), `lib/consultant/cohort-vitality.ts` (reused across consultant + admin dashboards for consistent numbers).
- **Seeded openers for all conversation modes**: goal / reflection / general now all flow through `lib/thought-partner/start-session.ts` so learners never land on a blank chat. Intake opener rewritten with trust/privacy framing + explicit completion transition.
- **"What's new" pattern** on every cross-role learner view: coach dashboard + learner detail, consultant learner detail, admin People (via at-risk chips).

1. **Learner first-run** — seeded openers, intake privacy framing + explicit completion transition, dashboard intro card explaining Thought Partner before any CTA uses the term, register form polish (password live-validate, show-pw, humanized role, locked-email explainer), chat chrome (animated thinking bubble, friendly errors, approval-pill "waiting on you" tag), empty-hint rewrite without insider jargon.
2. **Learner daily loop** — clickable dashboard stat cards, sprint vitality on goal cards, sprint chips on action-log rows, sprint-progress labels with `role="progressbar"`, reflection form collapsible with expanded-default for new users, sidebar mode-badge colors, in-UI conversation delete confirm, age-aware chat resumption subheading ("picking up from Tuesday"), seeded-opener failsafe banner.
3. **Learner depth** — capstone share/finalize inline confirms with "what becomes visible / stays editable" explainers, community audience banner (Posting to COHORT vs ALUMNI NETWORK, color-coded), assessment re-upload confirm, message send-failure visible states with Retry/Discard, pre-session privacy explainer, assessment "Ready" top banner with Combined-themes chip, capstone locked state with days-remaining + prep links, memory dropped third-person requirement + confidence-dot labels + source-conversation links, lesson viewer module-scoped "Lesson X of Y in <Module>" breadcrumb, message timestamps with date context, community comment cap + a11y.
4. **Coach portal** — `/coach/dashboard` search/filter/sort with "since last recap" chips, sprint vitality on cards, coaching-since-date, "New" assignment chip. Learner detail: prev/next nav + ←/→ keyboard shortcuts, since-last-recap top strip, thought-partner activity panel, ownership labels (Private to you / Visible to learner / From learner). **AI session-recap drafts wired** (`lib/coach/recap-draft-action.ts`) — Sonnet drafts a 150-word recap grounded in learner activity since coach's last recap; coach edits before saving. Action items gain description field + default due date + overdue highlighting.
5. **Consultant portal** — `consultant/layout.tsx` route-boundary auth guard; dashboard vitality chips per cohort; cohort detail at-a-glance metrics + reflection-themes strip + searchable/filterable roster + coaches panel with inline coach-assignment control; cohort metadata editor; learner detail with prev/next nav + 14d rolling what's-new + sprint vitality + TP activity + session-recap coach attribution + override badge.
6. **Org admin portal** — `add_user_fks_to_profiles` migration fixed the silent PostgREST-embed failure that was showing "0 active members" when members existed. People page: search/filter/sort across role/cohort/coach/at-risk-flags/status, bulk select + sticky action bar, at-risk chips per row, inline cohort & coach pickers, role-change with in-UI confirm. Three invite modes: single (sticky defaults), bulk paste, manual-add-user (creates confirmed user with temp password — SMTP-bypass escape hatch). Invitations panel with Resend (rotates token + extends expiry) + Revoke. Coach-load bar-chart panel. Cohort management gains /admin/cohorts/[cohortId] detail page with multi-select bulk-move. Activity log gains filters (actor / action / date range) + humanized action labels + CSV export. Shared primitives: `ConfirmBlock`, `ROLE_LABEL` map, `requireAdmin` helper, activity-emitting admin action pattern.
7. **Super admin portal — UX sweep + capability expansion**. Both an audit pass on existing surfaces AND a net-new-capability batch so LeadShift support never needs to drop into Supabase. Audit pass: `super/layout.tsx` route-boundary guard; `ROLE_LABEL` / `roleBadgeClass` across all super surfaces; four `window.confirm()` → `ConfirmBlock` (moderation, course/module/lesson delete); `requireSuperAdmin` + `logSuperActivity` now wraps every mutating action with `super.*` audit keys; `/super/orgs` gains 8-metric cross-org dashboard + searchable/sortable org cards with per-org vitality chips; `/super/orgs/[id]` members → searchable/filterable/sortable; `/super/conversations` gains server-side title-search + mode/org/date-range filters + 50/page pagination; `/super/moderation` same; `/super/ai-usage` date-range (7/30/90/mtd/all) + org filter + daily sparkbar + 10k-row paginated aggregates; new `/super/activity` cross-org audit with scope (admin vs super) / org / actor / action / date filters + CSV export; new `/super/orgs/[id]/cohorts/[cohortId]` cohort detail with vitality metrics + roster chips + assigned courses + edit/archive panel; conversation viewer renders AI-SDK parts (text + collapsible tool-call details) instead of mid-sentence truncation; `/super/orgs/[id]/members/[userId]` gains 14-day since-strip + sprint vitality + nudge history + memory facts + coach notes / recaps / action items; consultant override errors now surface; `/super/export` shows live row counts per type, scoped to selected org. **Capability expansion**: `profiles.deleted_at` column + soft-delete pipeline (archives memberships + revokes sessions + login gate); `/super/users` global cross-org directory with search/filter/sort; `/super/users/[userId]` full edit console (profile fields, email change with optional skip-reverify, password reset link generator, email confirm, session revoke, super-admin toggle, per-membership role change, cross-org membership move, soft-delete with "soft-deleted" flag shown everywhere); `/super/invitations` cross-org invitation audit + revoke; super cohort CRUD (`superCreateCohort` / `superUpdateCohort` / `superArchiveCohort`) with "reassign N first" guard; `/super/resources` resource library CRUD (the previously learner-only /resources now has a real admin surface); `runMemoryDistillation` + `runNudgeDetection` manual triggers on learner detail for support debugging; super-delete actions for goals / reflections / action logs / memory facts / conversations (exposed for conversations on the viewer; other entry points ready for future UI); new `announcements` table with scope (global / org / cohort / role), tone (info / warning / success), per-user dismissals — broadcast UI at `/super/announcements`, banners render on learner dashboard via `getVisibleAnnouncements`; new `ai_errors` table + `logAiError` helper hooked into distill / title / nudge_opener paths, surfaced at `/super/ai-errors` with feature-grouped filtering. Super-admin actions log as `super.*` in activity log (20+ new action labels). Top-nav gains Users / Invitations / Resources / Activity Log / AI Errors / Announcements links.

Bug fixes shipped alongside Phase 6:
- Invite confirmation flow: corrected `/auth/consume` path (was `/onboarding/consume`), fixed nested `?token=` encoding.
- `registerAction` only consumes invite when `email_confirmed_at` is set — SDK sometimes surfaces user object without session.
- Sign-out buttons no longer unmount mid-click via conditional-form + onClick pattern.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=https://vcpuxpbncltyihnfnaim.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_9Goc_8Vizos-zEfXQfj6Kw_Oa9SOImY
SUPABASE_SERVICE_ROLE_KEY=(in .env.local, never commit)
ANTHROPIC_API_KEY=(in .env.local + Vercel)
NEXT_PUBLIC_APP_URL=https://leadacademy.vercel.app
NEXT_PUBLIC_SENTRY_DSN=(optional, activates Sentry when set)
```

## What to work on next

Immediately up next:
- **Phase 8 — cross-cutting polish** (mobile, a11y, brand consistency, loading/error states across the full app) now that the 7 portals (learner / coach / consultant / admin / super) have all had their UX sweep.

Near-term candidates:
- **Run the first `pnpm eval` baseline** — critical before further prompt tuning.
- **Drop `goals.active_focus_until`** — DB column is now dead weight, remove in a small follow-up migration.
- **Capture recent MCP migrations as `.sql` files** — back-fill `supabase/migrations/` with capstone_builder, consultant_role, consultant_per_learner_override, profile_intake_fields, ai_conversations_allow_intake_mode, add_user_fks_to_profiles so they're replayable in preview branches / dev environments.
- **Wire custom SMTP in Supabase Dashboard** (Resend or SendGrid) — built-in email sender is rate-limited even on Pro and unsuitable for production invite batches.
- **Capstone PDF export** — currently in-app only; "export story brief" as PDF would close the loop.
- **Expose member emails in admin/people** — currently blank because org_admin RLS can't read `auth.users.email`. Need a view or RPC that returns `(user_id, email)` for org members.
- E2E tests (Playwright).
- CI integration for `pnpm eval` (GitHub Action check on PRs).
- Production-conversation replay for evals (mine real `ai_messages` into fixture templates).
- Course quiz builder (schema supports it, no editor UI).
- Drag-and-drop reordering for modules/lessons.
- Course cover images.
- Content vs quiz lesson type toggle.

Later / bigger:
- Semantic search over memory facts (pgvector) — if the top-N approach starts missing relevance.
- Voice + multi-modal in thought-partner chat (PWA polish, browser speech API, image upload).
- Coach/consultant/admin rollup views for sprint progress + goal arcs across a cohort.
- Cohort program-dates model (capstone_unlocks_at is the first cohort-date field; workshop dates, peer-group dates, etc. could all land on `cohorts` so learners see the full schedule in-app).
- Phase 8 — cross-cutting polish (mobile, a11y, brand consistency, loading/error states across the full app) once Phase 7 is done.
