@AGENTS.md

# LeadAcademy — CLAUDE.md

## What this is

LeadAcademy is a leadership development platform built by LeadShift. It combines AI coaching (Claude), structured learning (courses/modules/lessons), assessment ingestion (PI, EQ-i, 360), goal-setting, reflections, daily challenges, community, messaging, and coach/admin portals — all in one multi-tenant app.

**Live:** https://leadacademy.vercel.app
**Repo:** https://github.com/joshwells235-create/leadacademy
**Supabase project:** `vcpuxpbncltyihnfnaim` in Leadshift org (`zuvrkjogtldbfqbpspkw`), us-east-2

## Tech stack

- **Framework:** Next.js 16 App Router (Turbopack), React 19, TypeScript
- **Styling:** Tailwind v4 with custom brand tokens in `globals.css`
- **Database / Auth / Storage / Realtime:** Supabase (Postgres 17)
- **AI:** Claude via `@anthropic-ai/sdk` + Vercel AI SDK `@ai-sdk/anthropic`. Server-side only — **never expose AI keys in the browser**
- **Rich text:** Tiptap (editor for course lessons, server-side HTML rendering for learners)
- **Package manager:** pnpm 10
- **Lint:** Biome (not ESLint)
- **Error tracking:** Sentry (`@sentry/nextjs`, activated via `NEXT_PUBLIC_SENTRY_DSN` env var)

## Key conventions

- **Next 16 note:** `middleware.ts` was renamed to `proxy.ts` exporting a `proxy()` function
- **Git:** Commits use `josh@leadshift.com` / "Josh Wells" passed per-command via `git -c` (never set global config)
- **Types:** `src/lib/types/database.ts` is generated from Supabase. Use the MCP tool `generate_typescript_types` with project ID `vcpuxpbncltyihnfnaim`, then update the file. Tables are in alphabetical order.
- **Server actions** follow a consistent pattern: Zod validation -> `createClient()` -> auth check -> membership/org_id lookup -> insert/update -> `revalidatePath` -> return `{ok}` or `{error}`
- **RLS:** Every table uses Row Level Security. Helper functions in Postgres: `is_super_admin()`, `is_org_member(org_id)`, `is_org_admin(org_id)`, `is_coach_in_org(org_id)`, `is_coach_of(learner_id)`
- **AI calls:** Always server-side via `/api/ai/*` routes. Key never in browser. Every conversation persisted to `ai_conversations` + `ai_messages`. Usage tracked in `ai_usage`.

## Brand

Colors defined as Tailwind theme tokens in `src/app/globals.css`:
- `brand-navy: #101d51` — nav background, primary headings, body text
- `brand-light: #f3f3f3` — page backgrounds
- `brand-pink: #EA0C67` — accent, destructive actions, Coach link
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
- **LeadShift creates all content.** Courses/modules/lessons/resources have no `org_id` — they're global catalog. Assigned to cohorts via `cohort_courses`.
- **Unified AI coach** with swappable modes (`general`, `goal`, `reflection`, `assessment`, `capstone`). Prompts in `lib/ai/prompts/`.
- **Invite-only signup.** No public registration. Org admins send invite tokens.
- **Default model:** Claude Sonnet 4.6 for chat, Opus 4.6 for heavy synthesis.

## Database tables (30+)

Identity: `organizations`, `profiles`, `memberships`, `cohorts`, `coach_assignments`, `invitations`
Coaching: `goals`, `action_logs`, `reflections`, `daily_challenges`, `assessments`, `assessment_documents`
AI: `ai_conversations`, `ai_messages`, `ai_usage`
Coach tools: `pre_session_notes`, `coach_notes`, `session_recaps`, `action_items`
Learning: `courses`, `modules`, `lessons`, `cohort_courses`, `lesson_progress`
Social: `community_posts`, `community_likes`, `community_comments`, `threads`, `thread_participants`, `messages`, `notifications`
Resources: `resources`
Audit: `activity_logs`

## Routes (38 pages)

### Learner
- `/dashboard` — daily challenge, coach items, goals overview, quick access, onboarding for first-time
- `/goals`, `/goals/[id]` — list + detail with inline coach chat
- `/action-log` — logged actions grouped by day + form
- `/reflections` — journal with AI theme tagging + delete
- `/assessments` — upload PI/EQ-i/360 PDFs -> Claude extraction
- `/learning`, `/learning/[courseId]`, `/learning/[courseId]/[lessonId]` — course progress + lesson viewer
- `/coach-chat` — streaming Claude with mode/lens URL params
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

## Phases completed (all 10)

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

Plus: brand alignment, dashboard cleanup, 4 UX audit passes, mobile responsive nav, first-time onboarding, LeadShift logo integration.

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

The implementation plan at `../Leadership Academy Code/docs/IMPLEMENTATION_PLAN.md` in the alpha repo has the full roadmap. All 10 phases are complete. Potential next work:
- E2E tests (Playwright)
- Supabase Auth URL configuration for production email flows (password reset, invite confirmation)
- Course quiz builder (schema supports it, no editor UI)
- Drag-and-drop reordering for modules/lessons
- AI-generated session recap drafts (schema + route prepped, button not wired)
- Conversation history resumption in coach chat
- Course cover images
- Content vs quiz lesson type toggle
- Responsive polish on specific pages (two-column layouts on tablet)
- More granular loading skeletons per page
