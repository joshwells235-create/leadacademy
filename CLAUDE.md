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
- **RLS:** Every table uses Row Level Security. Helper functions in Postgres: `is_super_admin()`, `is_org_member(org_id)`, `is_org_admin(org_id)`, `is_coach_in_org(org_id)`, `is_coach_of(learner_id)`
- **AI calls:** Always server-side via `/api/ai/*` routes. Key never in browser. Every conversation persisted to `ai_conversations` + `ai_messages`. Usage tracked in `ai_usage`.
- **No cron infrastructure.** Async work (memory distillation, nudge detection, title generation, assessment rollup synthesis) runs fire-and-forget inside the request that naturally triggers it.

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
- `coach`: coaches assigned learners, writes notes/recaps/action items
- `learner`: the participant

## Product decisions (locked)

- **Multi-tenant** from day one. `organizations` -> `cohorts` -> users via `memberships`. Every user-scoped table has `org_id`.
- **Three lenses, not three silos.** Goals are integrative — `impact_self`, `impact_others`, `impact_org` are all NOT NULL. `primary_lens` is optional metadata about where the learner started, not a silo.
- **Goals are program-long; sprints make them practicable.** A goal like "stop being the safety net" is the long aspiration. Sprints (`goal_sprints`) are 4-8 week practice windows with a specific behavior and a visible action count — that's what makes progress feelable. A goal has many sprints, at most one active.
- **LeadShift creates all content.** Courses/modules/lessons/resources have no `org_id` — they're global catalog. Assigned to cohorts via `cohort_courses`.
- **Unified AI thought partner** with swappable modes (`general`, `goal`, `reflection`, `assessment`, `capstone`). Prompts in `src/lib/ai/prompts/`.
- **Invite-only signup.** No public registration. Org admins send invite tokens.
- **Models:** Sonnet 4.6 for chat + synthesis; Opus 4.6 for heavy judgment (eval judge); Haiku 4.5 for cheap labeling (conversation titles).
- **Assessments are tendencies, not diagnoses.** PI findings are rendered with "tends toward" language, not "is X". EQ-i and 360 use direct language. Participants no longer see raw extraction on `/assessments` — they see a "Ready" state and debrief with the thought partner.
- **Proactive check-ins are opt-in-by-default but learner-controllable.** The thought partner can reach out with up to 2 messages/week (global cap) + 14-day per-pattern cooldown. Opt-out toggle at `/memory`.

## The thought-partner product (the core)

Everything below is the AI thought-partner loop. Most production value lives here.

### Context assembled on every chat turn (`src/lib/ai/context/`)

One canonical learner context is built on every turn from the real DB — shared across modes, callers, and the proactive-nudge opener generator. Sections:
- Identity + membership
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
| `finalize_goal` | Yes | Saves an integrative three-lens SMART goal |
| `update_goal_status` | Yes | Completes / archives / reopens a goal |
| `set_daily_challenge` | Yes | Sets today's or tomorrow's daily challenge (upserts, flags collision) |
| `start_goal_sprint` | Yes | Starts a sprint on a goal (title + specific practice + end date); closes any active sprint first |

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
- Clicking a nudge card routes to `/coach-chat/from-nudge/[id]` which generates a rich Sonnet opener grounded in pattern data + full learner context, seeds a new conversation, marks nudge as acted, redirects into `/coach-chat?c=<id>`
- Dismiss action sets `dismissed_at` (counts toward cap — can't dismiss to refill)

### Assessment debrief

- `/assessments` no longer shows rendered per-report summaries — just a "Ready" state once processed
- "Debrief with thought partner" button calls `startAssessmentDebrief` server action which creates a conversation with a proactive Sonnet-generated opener grounded in the learner's full context (including combined themes)
- Extraction prompt is per-type: PI forbids absolute language (requires "tends toward...", "can lean toward..."); EQ-i and 360 keep direct language
- Combined-themes synthesis runs on rollup when ≥2 reports are ready, stored as `assessments.ai_summary._combined_themes`

### Evals (`evals/`)

- 26 YAML fixtures in `evals/fixtures/` across 7 categories: context_grounding, tool_triggering, tool_restraint, tone_language, mode_boundaries, anti_patterns, sprint_coaching
- Runner reconstructs the real system prompt (same PERSONA + mode + context formatter) with mock tool handlers that record calls
- Opus judge via `generateObject`, one pass/fail verdict per criterion with reasoning
- Baseline stored at `evals/baseline.json`; `pnpm eval` diffs against it and exits nonzero on regression
- Flags: `--update` (save new baseline), `--filter <name>`, `--verbose`

## Database tables

Identity: `organizations`, `profiles`, `memberships`, `cohorts`, `coach_assignments`, `invitations`
Coaching: `goals`, `goal_sprints`, `action_logs`, `reflections`, `daily_challenges`, `assessments`, `assessment_documents`
AI: `ai_conversations`, `ai_messages`, `ai_usage`, `learner_memory`, `coach_nudges`
Coach tools: `pre_session_notes`, `coach_notes`, `session_recaps`, `action_items`
Learning: `courses`, `modules`, `lessons`, `cohort_courses`, `lesson_progress`
Social: `community_posts`, `community_likes`, `community_comments`, `threads`, `thread_participants`, `messages`, `notifications`
Resources: `resources`
Audit: `activity_logs`

Key cross-references:
- `action_logs.sprint_id` — FK to `goal_sprints`. DB trigger `bump_sprint_action_count` keeps `goal_sprints.action_count` honest. New action inserts stamp the goal's active sprint; historical rows stay null.
- `goal_sprints` partial unique index on `(goal_id) WHERE status = 'active'` — at most one active per goal.
- `ai_conversations.distilled_at` — set when memory extraction has processed the conversation.
- `ai_conversations.title` — auto-filled by Haiku after first exchange.
- `goals.active_focus_until` — **deprecated**; no code reads or writes it. Dropped in a future migration.
- `profiles.proactivity_enabled` — per-learner master switch for nudges.

## Routes

### Learner
- `/dashboard` — proactive nudge card (above Today), daily challenge, coach items, goals overview, quick access, onboarding for first-time
- `/goals`, `/goals/[id]` — goal detail with **sprint section** (active + history + start), SMART criteria, three-lens impacts, action log
- `/action-log` — logged actions grouped by day + form (stamps sprint_id)
- `/reflections` — journal with AI theme tagging + delete
- `/assessments` — upload PI/EQ-i/360 PDFs; "Debrief with thought partner" seeds proactive conversation
- `/learning`, `/learning/[courseId]`, `/learning/[courseId]/[lessonId]` — course progress + lesson viewer
- `/coach-chat` — streaming Claude, auto-resumes ≤30d, sidebar
- `/coach-chat/new` — explicit new conversation
- `/coach-chat?c=<id>` — resume specific
- `/coach-chat/from-nudge/[id]` — click handler for proactive nudges; generates opener + redirects
- `/memory` — what the thought partner remembers + proactivity toggle
- `/community` — two-tab feed (cohort + alumni)
- `/resources` — filterable card grid
- `/messages`, `/messages/[threadId]` — real-time DM with Supabase Realtime
- `/pre-session` — coaching session prep form

### Coach
- `/coach/dashboard` — assigned learners with stats
- `/coach/learners/[id]` — full learner view + notes + recaps + action items

### Org Admin
- `/admin/dashboard` — org-wide stats + per-learner activity table
- `/admin/people` — invite, role management, coach assignment
- `/admin/cohorts` — cohort CRUD
- `/admin/activity` — audit log

### Super Admin
- `/super/orgs`, `/super/orgs/[id]` — org management + settings
- `/super/orgs/[id]/members/[userId]` — cross-org learner deep-dive
- `/super/orgs/[id]/assign-courses` — cohort-course assignment matrix
- `/super/course-builder/...` — Tiptap rich editor for courses
- `/super/ai-usage` — cross-org AI spend dashboard
- `/super/conversations`, `/super/conversations/[id]` — AI transcript viewer
- `/super/moderation` — community post/comment moderation
- `/super/export` — CSV data export

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

Plus: Leadership Academy branding sweep (all user-facing strings).

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

Near-term candidates:
- **Run the first `pnpm eval` baseline** — critical before further prompt tuning
- **Drop `goals.active_focus_until`** — DB column is now dead weight, remove in a small follow-up migration
- E2E tests (Playwright)
- Supabase Auth URL configuration for production email flows (password reset, invite confirmation)
- AI-generated session recap drafts (schema + route prepped, button not wired)
- CI integration for `pnpm eval` (GitHub Action check on PRs)
- Production-conversation replay for evals (Phase 6.1 — mine real `ai_messages` into fixture templates)
- Course quiz builder (schema supports it, no editor UI)
- Drag-and-drop reordering for modules/lessons
- Course cover images
- Content vs quiz lesson type toggle

Later / bigger:
- Semantic search over memory facts (pgvector) — if the top-N approach starts missing relevance
- Voice + multi-modal in thought-partner chat (PWA polish, browser speech API, image upload)
- Coach/admin rollup views for sprint progress + goal arcs across a cohort
