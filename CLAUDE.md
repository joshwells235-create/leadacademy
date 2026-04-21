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

## Product positioning — premium LMS + coaching platform

Leadership Academy isn't a "coaching tool with some lessons bolted on." The ambition is to match or beat **Lessonly (Seismic Learn) / Docebo / Articulate Rise / Northpass / Workramp** on their own turf *and* offer something none of them can — AI thought partnership and human-coach infrastructure grounded in the learner's full leadership journey.

**The competitive moat: contextual AI.** Lessonly and peers have bolted AI onto course delivery in the last year. Ours is built from the ground up: the thought partner knows the learner's goals, sprints, assessments (PI / EQ-i / 360), reflections, memory facts, and capstone arc. A quiz result can trigger a reflection conversation. A completed course can seed a goal. A coach recap can feed a practice-scenario rubric. That's not a feature peers can ship in a quarter.

**Feature-parity roadmap (LMS phases).** A–D are shipped; E is up next; F is the enterprise floor.

- **Phase A — Course builder foundations.** Shipped. Security + data integrity + reorder + duplicate + description + linked resources.
- **Phase B — Rich content + quiz engine.** Shipped. Tables, responsive images, video resolver, and a full quiz engine (six question types, author + player + analytics).
- **Phase C — Paths, prereqs, certificates.** **Shipped.** Lesson + course prerequisites with cycle-prevention triggers, scheduled unlock per cohort-course, soft due dates, learning paths (auto-materialize into `cohort_courses`), brandable PDF certificates with re-cert + revocation. "A course" is now "a program."
- **Phase D — Engagement + analytics.** **Shipped.** Per-course analytics with drop-off + AI-engagement metrics, completion-celebration `debrief` mode grounded in course + context, per-lesson notes that feed `LearnerContext`, scroll-position resume, ask-the-room Q&A (AI-first, escalate-to-coach).
- **Phase E — Practice scenarios (the Lessonly moat).** **Up next.** Learner records video/audio response to a prompt; coach reviews + rubric-scores; thought partner drafts the first-pass feedback grounded in goals/assessments/memory. This is the single feature that wins a bake-off against Lessonly — peers have bolted AI on; ours is contextual from the ground up.
- **Phase F — Enterprise hygiene.** Version history + diff/rollback on lessons, approval workflows (draft → review → published), scheduled publish, template library, author collaboration (soft-lock or last-write-wins warning), SCORM import if an enterprise client demands it. Not a moat — a floor that keeps us credible in RFP conversations.

If a new feature sits outside this roadmap, check that it doesn't duplicate work a later phase will cover.

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
- **AI-mode check constraint.** `ai_conversations.mode` has a CHECK constraint listing the allowed modes. **When adding a new mode, update the constraint in the DB alongside the TypeScript enum / Zod schema (`/api/ai/chat` requestSchema) / runner map / `/coach-chat/page.tsx` URL-param parsing / `src/components/chat/coach-chat.tsx` Mode type** — otherwise inserts fail silently and the fallback redirect lands the user on a blank chat. Current modes: `general | goal | reflection | assessment | capstone | intake | debrief | coach_partner`.
- **Coach-primary routing.** `getUserRoleContext` in `src/lib/auth/role-context.ts` is the single source of truth for `coachPrimary` (user has coach membership, no learner membership, no org_admin/consultant role, not super_admin). The `(app)/layout.tsx` passes it into `TopNav`; the dashboard page redirects coach-primary users to `/coach/dashboard`; the learning/community/messages pages branch their queries and copy on it; `/coach-chat` loads coach_partner mode and scopes the sidebar to coach_partner conversations. When adding a new learner-facing flow, decide up front whether coach-primary users should see it — most of the time the answer is "reframed for the coach" or "hidden."
- **coach_partner mode uses a separate system prompt + context.** Unlike the other modes which share PERSONA + a mode-specific block, `coach_partner` replaces PERSONA entirely with `COACH_PARTNER_PROMPT` (addresses the coach, references coachees in third person) and swaps `buildLearnerContext` for `buildCoachContext`. The chat route branches on `isCoachPartner = mode === "coach_partner"` and serves a narrower tool set (`log_coach_note` only — exposing learner-facing tools would let the coach's thought partner silently write to a coachee's record). When adding coach-side tools, register them in the coach_partner branch of `toolSet`; don't merge them into the default set.
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
- **`lessons.type` CHECK is `'content' | 'quiz'` — not `'lesson'`.** Default is `'content'`. The lesson editor wrapper historically used the literal `'lesson'` for the non-quiz toggle, which silently 23514-failed every save because the wrapper threw away `updateLesson`'s error return. Fixed in d74e6c7 (wrapper now uses `'content'`; `updateLesson` has an explicit return type; the save-state indicator surfaces `⚠` on error). Never use `'lesson'` as a type value anywhere — it's not a valid enum member.
- **Don't use `isomorphic-dompurify` on Vercel.** It pulls in jsdom, whose transitive dep `html-encoding-sniffer` does `require('@exodus/bytes')` which is ESM-only — fails with `ERR_REQUIRE_ESM` on Vercel's Node runtime. Use `sanitize-html` (pure JS, no DOM dep) instead. `LessonViewer` uses it with an explicit allowedIframeHostnames list for YouTube/Vimeo/Loom. If you need DOMPurify specifically, import `dompurify` directly and pass a happy-dom window.
- **Dynamic-import heavy server-side deps.** `@tiptap/html` (pulls happy-dom), `@react-pdf/renderer` (chunky layout engine), `sanitize-html`, and Tiptap extensions should all be loaded via `await import(...)` inside the function that needs them — NOT at module top level. On Vercel's serverless runtime, top-level imports can throw at load time (the happy-dom "Failed to load external stylesheet" bug blocked the entire lesson page in C5). See `src/components/editor/lesson-viewer.tsx` + `src/lib/certificates/render.ts` for the pattern. Bonus: keeps cold-start size down for every unrelated page that transitively touches these modules.
- **Defense-in-depth `if (!user) redirect('/login')` in every `(app)/*` page.** The `(app)/layout.tsx` redirects unauth users, but under Next 16 RSC streaming the page body can race the layout and start rendering before the redirect resolves. Without a null guard, `user!.id` crashes with "Cannot read properties of null (reading 'id')" — which surfaces as a generic 500 (not the nice `error.tsx` boundary) and is unrecoverable for the learner. Every page under `(app)` that reads `user.id` should guard it explicitly right after `getUser()`.
- **Super-admin preview needs to skip gate *computation*, not just redirects.** For surfaces with lock indicators (lesson prereqs, course-level prereqs, course scheduling), super-admins bypass the redirect but the UI still rendered lock cards because `computeCourseGates` / `computeCourseLessonGates` still ran. Fix: skip the gate computation entirely when the viewer is super_admin so the visual state matches their actual access. A true "Preview as learner" toggle (flip back to learner-eye) is a future Phase D candidate.
- **PostgREST embeds can return single-or-array depending on FK disambiguation.** When you use `courses!course_prerequisites_required_course_id_fkey(title)` style explicit-FK embeds, PostgREST may return the relation as an array even for to-one shapes. Always normalize with `Array.isArray(v) ? v[0] ?? null : v` before reading fields. See `src/lib/learning/access-gate.ts` for the pattern.
- **Learning path design: auto-materialize into `cohort_courses`.** Assigning a path to a cohort creates/updates individual `cohort_courses` rows (idempotent — never overwrites existing schedule/due-date edits). The `cohort_learning_paths` row is the *origin*; `cohort_courses` stays canonical so all existing readers (vitality, due dates, scheduled unlock, lesson gates) keep working unchanged. **Path delete does NOT tear down materialized assignments** — learners keep their enrollment; only the "Your path" framing disappears.
- **Certificate re-certification is a new row, not a mutation.** When a cert expires and the learner re-completes, we insert a fresh `certificates` row with the new `issued_at` / `expires_at`. The original row keeps its old `expires_at`. "Current cert holders" queryable via `revoked_at is null and (expires_at is null or expires_at > now())`. Audit trail intact.
- **Storage bucket convention for certificates.** PDFs cached to Supabase Storage at `certificates/{user_id}/{certificate_id}.pdf`. The storage RLS policy keys on `(storage.foldername(name))[1] = auth.uid()::text` so learners can read their own PDFs via signed URL. Pattern generalizes to any per-user private file.
- **Lesson notes feed `LearnerContext` (the differentiator).** Notes aren't just private jottings — the 10 most-recent are injected into the learner-context prompt on every chat turn as a named section, clipped at 400 chars each. A learner can jot "I'm skeptical of this delegation model" in a lesson and open a chat an hour later and the thought partner already knows. Don't break this coupling when touching notes — it's the moat.
- **`lesson_progress.started_at` stamps on first lesson view.** Fire-and-forget via `stampLessonStarted` in `src/lib/analytics/stamp-started.ts`. Skipped for super-admin previews so author activity doesn't muddy drop-off metrics. Backfilled for existing completed rows as `completed_at - 1m` so historical data doesn't show as "instantaneous completion."
- **Dynamic-import server actions from inline forms.** The learner course-complete banner uses `action={async () => { "use server"; const { startCourseDebrief } = await import(...); await startCourseDebrief(courseId); }}`. Dynamic import keeps the debrief pipeline (Sonnet prompt, LearnerContext assembly) out of the course-detail page's initial module graph while still letting us bind `courseId` cleanly into the form action.

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
- **Unified AI thought partner** with swappable modes (`general`, `goal`, `reflection`, `assessment`, `capstone`, `intake`, `debrief`). Prompts in `src/lib/ai/prompts/modes/`. `debrief` (D2) is course-specific: invoked from the course-complete banner, seeded with a course-grounded opener, closes the learning-to-life gap that peer LMSs can't address. There's also a non-mode AI surface in D4 — `src/lib/qa/answer.ts` — for one-shot grounded answers to lesson-scoped questions.
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
- **Recent lesson notes** (last 10, per-note clipped at 400 chars, with lesson + course titles). D3 differentiator — the thought partner picks up threads the learner flagged in lessons without them re-explaining.
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
- 10 patterns, in priority order: `sprint_ending_soon`, `sprint_needs_review`, `challenge_followup`, `undebriefed_assessment`, `course_debrief_pending`, `sprint_quiet`, `reflection_streak_broken`, `new_course_waiting`, `momentum_surge`, `goal_check_in`
- **Artifact-age gates.** "Quiet" detectors (`goal_check_in`, `sprint_quiet`, `course_debrief_pending`) require the underlying artifact to be at least as old as the lookback window — otherwise they'd trivially fire on brand-new artifacts. `goal_check_in` needs goal created ≥45 days ago; `sprint_quiet` needs sprint created ≥10 days ago; `course_debrief_pending` needs course finished ≥48h ago (give the completion feel-good a breath before nudging).
- **`course_debrief_pending` is special.** It fires when a learner finished a course but hasn't opened a `debrief`-mode conversation for it. Routes via special-case in `/coach-chat/from-nudge/[id]` that calls `startCourseDebrief(courseId)` directly (instead of the generic nudge opener generator) so the debrief gets a grounded per-course opener. 30-day cooldown.
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

### Course debrief (`src/lib/debrief/`, `src/lib/ai/prompts/modes/debrief.ts`)

- Brand-new `debrief` AI mode introduced in Phase D2. Three-beat arc: what landed → where it maps to goals/sprints/assessments → one concrete move to try this week. No generic "tell me about the course" chit-chat.
- Course-complete banner on `/learning/[courseId]` offers a "Debrief with thought partner →" CTA — an inline server-component form with `action={async () => { "use server"; const { startCourseDebrief } = await import(...); await startCourseDebrief(courseId); }}`
- `startCourseDebrief(courseId)` creates a `debrief`-mode conversation, generates a Sonnet opener grounded in the course (title, module titles, learner progress) + full learner context (goals, active sprint, recent reflections, assessments), stores `{ courseId }` in `context_ref` so analytics can count debriefs-per-course, seeds the opener as an assistant message, redirects to `/coach-chat?c=<id>`
- `ai_conversations.mode` CHECK constraint includes `debrief`; the chat-route Zod enum and `MODE_PROMPTS` runner map both include it; `/coach-chat` page + `CoachChat` component both know the Mode union. Missing any of these → silent insert failure.
- The `course_debrief_pending` nudge (see Proactive coaching) surfaces the CTA to learners who completed a course but walked away without debriefing — the closing-the-loop safety net.

### Coach Thought Partner (`src/lib/coach-partner/`, `src/lib/ai/prompts/modes/coach-partner.ts`, `src/lib/ai/context/build-coach-context.ts`)

- `coach_partner` AI mode: the Thought Partner speaking TO THE COACH, not to a learner. Shipped as part of the coach portal rebuild. Uses a different system prompt (`COACH_PARTNER_PROMPT` replaces PERSONA), a different context assembler (`buildCoachContext` instead of `buildLearnerContext`), and a narrower tool set (just `log_coach_note`).
- Two shapes of context, both built by the same assembler:
  - **Caseload overview** (default): one block per coachee with active sprint, last recap, flagged-question count, open action items count. Up to 12 coachees shown. Used when the coach is scanning "what's alive across everyone."
  - **Learner-scoped deep-dive** (when `context_ref.learnerId` is set): full single-coachee snapshot — goals, active sprint, recent actions + reflections, last recap, open action items, assessment themes, coach's prior notes, flagged questions. Used when the coach clicks "Think this through" from `/coach/learners/[id]`.
- **Coach's own memory + journal flow in.** Any `learner_memory` rows keyed to the coach's `user_id` render as "About this coach's practice" (Phase 2b will wire distillation to populate these from coach_partner conversations). The 10 most-recent `coach_journal_entries` render as "Coach's recent journal entries" so the coach's own voice carries between conversations.
- **Three entry points:**
  - Coaching Home "Plan your week with Thought Partner" card → `startCoachPartnerSessionAction()` (caseload-level).
  - Coaching Home "Start weekly review" card → `startWeeklyReviewAction()` (three-beat Sunday-thinking opener, marked `context_ref.kind = "weekly_review"`).
  - `/coach/learners/[id]` header "Think this through with Thought Partner →" button → `startCoachPartnerSessionAction(learnerId)` (learner-scoped).
- Both actions delegate to `createSeededCoachPartnerConversation` (in `start-session.ts`), which is a pure worker function — it inserts the conversation, generates the opener, writes the first assistant message, and returns the id. The action layer handles auth, ownership validation, and the redirect. This split lets `/coach-chat` page server-seed a caseload conversation inline for coach-primary users who land on the page with no target.
- **`log_coach_note` is the only tool.** Auto-applied, writes to `coach_notes` against a specific coachee with an `is_coach_of` ownership backstop check. Never expose learner-facing tools (`log_action`, `create_reflection`, `finalize_goal`, etc.) in coach_partner mode — those would let the coach's thought partner silently write to a coachee's record, which violates the product boundary.
- **AI-drafted coach artifacts** (not Thought Partner conversations, but sibling ephemeral helpers):
  - `generateRecapDraft` — post-session recap, surfaced via the `RecapForm` AI-draft button on `/coach/learners/[id]`.
  - `generateSessionPrepDraft` — pre-session prep, surfaced via `PrepDraftPanel` on `/coach/learners/[id]`. Not persisted — coach reads, maybe copies, walks into the session.
  - `generateCheckInDraft` — 2-4 sentence warm check-in message grounded in recent learner activity, surfaced via `CheckInDraftButton` on `/messages/[threadId]` when the viewer coaches the other participant. Edit-in-place and send via the existing `sendMessage` action.

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
Coach tools: `pre_session_notes`, `coach_notes`, `coach_journal_entries`, `session_recaps`, `action_items`
Learning: `courses`, `modules`, `lessons`, `cohort_courses`, `lesson_progress`, `lesson_resources`, `quiz_settings`, `quiz_questions`, `quiz_attempts`, `lesson_prerequisites`, `course_prerequisites`, `learning_paths`, `learning_path_courses`, `cohort_learning_paths`, `certificates`, `lesson_notes`, `lesson_questions`
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
- `lessons.description` + `lessons.duration_minutes` — lesson-level summary + estimated minutes. Used on course overview and in the lesson header. Course total duration rolls up from lessons (falls back to author-set `modules.duration_minutes` if no lesson durations).
- `lesson_resources` — junction table linking lessons to library resources (`resources` table). RLS: all signed-in users read, super_admin writes. Populated via `linkLessonResource`.
- `quiz_settings` (1:1 with quiz-type lessons), `quiz_questions`, `quiz_attempts` — the quiz engine. Six question types (`single_choice`, `multi_choice`, `true_false`, `short_answer`, `matching`, `ordering`) with per-type JSONB config validated by Zod in `lib/learning/quiz-actions.ts`. Pass threshold in `quiz_settings.pass_percent` gates `lesson_progress.completed`. `quiz_attempts.answers` is keyed by question_id → `{response, correct, points_earned}` so post-hoc analytics can compute per-question correctness without re-grading.
- `lesson_progress` cascades on lesson delete (FK `ON DELETE CASCADE`) — hard-deleting a lesson cleans up learner progress automatically.
- `lesson_progress.started_at` — D1 analytics column; fire-and-forget stamped on first lesson view via `stampLessonStarted`. Enables drop-off funnel + median time-to-complete without retrofitting the whole progress model. Existing rows backfilled as `completed_at - 1m`.
- `lesson_progress.last_scroll_pct` — D3 scroll-resume. `smallint` 0..100, throttled-stamped client-side; lesson viewer shows a "Jump to where you left off" chip when ≥10%.
- `lesson_prerequisites (lesson_id, required_lesson_id)` + `course_prerequisites (course_id, required_course_id)` — C1 junction tables with recursive-CTE cycle-prevention triggers. Self-ref FK cascade on delete. Gate checks centralized in `src/lib/learning/access-gate.ts` (`computeCourseLessonGates`, `computeCourseGates`, `computeSingleLessonGate`) — used by BOTH lesson-page redirects AND lock-icon UI so there's one source of truth.
- `cohort_courses.available_from`, `cohort_courses.available_until` — C2 scheduled unlock (reuses pre-existing `date` columns). `cohort_courses.due_at` — C3 soft due date; rendered via `lib/learning/due-status.ts` helper returning on_track / due_soon / overdue / complete + chip class.
- `learning_paths` + `learning_path_courses (path_id, course_id, order)` + `cohort_learning_paths (cohort_id, path_id)` — C4. Assigning a path to a cohort auto-materializes its courses into `cohort_courses` rows; path delete preserves the materialized rows so per-cohort edits aren't lost.
- `certificates` — C5. One row per issuance (re-certification creates a new row, never mutates). Cert can be scoped to `course_id` OR `path_id`. `revoked_at` / `revoked_reason` for admin revocation; restoring clears `revoked_at`. `courses.cert_validity_months` + `learning_paths.cert_validity_months` control re-cert expiry (null = never expires).
- `certificates` storage bucket: private `certificates/` bucket; per-user folder RLS (`storage.foldername = auth.uid()::text`) — PDFs served via server-minted signed URL (1h lifetime) cached on the row.
- `lesson_notes (user_id, lesson_id unique)` — D3 learner note scratchpad. RLS: learner rw, coach/consultant/super read. Last 10 notes (clipped 400 chars, with lesson + course title) fed into `LearnerContext` on every chat turn so the thought partner picks up threads without the learner re-explaining.
- `lesson_questions` — D4 ask-the-room. `question`, `ai_answer`, `answered_at`, `flagged_to_coach_at`, `coach_user_id`, `coach_response`, `coach_responded_at`, `resolved_at`. AI answer generated synchronously on ask (sub-2s feel required — the "ask the room" metaphor dies on async). Flagging notifies the active coach; coach reply notifies the learner. `notifications` table uses columns `type` and `link` (NOT `kind`/`link_url`), no `org_id` — trip-up from Phase D4.
- `ai_conversations.mode` now includes `debrief` — added to the CHECK constraint, the chat route Zod enum, and `MODE_PROMPTS`. `ai_conversations.context_ref` stores `{ courseId }` for debrief-mode conversations so analytics can count debriefs per course.
- `ai_conversations.mode` also includes `coach_partner` — the Coach Thought Partner (Phase 2 of the coach portal rebuild). `context_ref` stores `{ learnerId }` for coachee-scoped deep-dives and/or `{ kind: "weekly_review" }` for the Sunday-thinking ritual. Coach-primary users' sidebar filters to `coach_partner` mode only; learner-facing modes never appear for them. Tool set in this mode is intentionally narrow (`log_coach_note` only).
- `coach_journal_entries` — caseload-level private scratchpad for the coach (patterns across coachees, their own style choices). `(coach_user_id, content, themes[], entry_date)` with RLS scoped to the coach (org_admin does NOT get read access, unlike `coach_notes`); super_admin reads allowed. Last 10 entries flow into `CoachContext` on every coach_partner turn so the coach's own voice carries between conversations. Separate from `coach_notes` (which is learner-scoped via NOT NULL FK).

## Routes

### Learner
- `/dashboard` — intake CTA (when pending), proactive nudge card, daily challenge, coach items, goals overview, quick access, onboarding for first-time
- `/profile` — editable profile (role, team, company, tenure, context notes); "walk through it conversationally" re-opens intake mode
- `/goals`, `/goals/[id]` — goal detail with **sprint section** (active + history + start), SMART criteria, three-lens impacts, action log
- `/action-log` — logged actions grouped by day + form (stamps sprint_id)
- `/reflections` — journal with AI theme tagging + delete
- `/assessments` — upload PI/EQ-i/360 PDFs; "Debrief with thought partner" seeds proactive conversation
- `/capstone` — capstone builder (locked until `cohorts.capstone_unlocks_at`; entry state + workspace after unlock)
- `/learning`, `/learning/[courseId]`, `/learning/[courseId]/[lessonId]` — course progress + lesson viewer. Course overview shows "Your path" card when the cohort has a path assigned; lesson viewer has scroll-resume chip (D3), collapsible notes panel (D3), and `LessonQuestions` ask-the-room card (D4)
- `/learning/[courseId]/certificate` — course-level certificate (PDF download + share)
- `/certificates`, `/certificates/[certId]` — learner cert directory + individual cert view
- `/coach-chat` — streaming Claude, auto-resumes ≤30d, sidebar
- `/coach-chat/new` — explicit new conversation
- `/coach-chat?c=<id>` — resume specific
- `/coach-chat?mode=intake|goal|reflection|assessment|capstone|debrief` — start a typed conversation (usually reached via a server-action CTA that seeds an opener, not a bare link)
- `/coach-chat/from-nudge/[id]` — click handler for proactive nudges; generates opener + redirects
- `/memory` — what the thought partner remembers + proactivity toggle
- `/community` — two-tab feed (cohort + alumni)
- `/resources` — filterable card grid
- `/messages`, `/messages/[threadId]` — real-time DM with Supabase Realtime
- `/pre-session` — coaching session prep form

### Coach
- `/coach/dashboard` — **Coaching Home**. Caseload-pulse strip (active · on a sprint · flagged Q's · overdue items · quiet 14d+), ordered priority queue (flagged questions → overdue action items → overdue recap → quiet coachee → new assignment), Plan-your-week + Weekly-review Thought Partner cards, searchable/filterable/sortable full-caseload grid below the fold with per-card "since last recap" chips.
- `/coach/learners/[id]` — top "since last recap" strip, prev/next nav (←/→ keyboard), sprint vitality on goals, thought-partner activity panel (read-only), AI-drafted session recap button, AI-drafted session **prep** panel (ephemeral, Sonnet grounds in since-last-recap state), "Think this through with Thought Partner →" button that seeds a learner-scoped coach_partner conversation, full action-item / notes / recap UI, `FlaggedQuestions` panel (D4) with waiting-first ordering + inline reply editor.
- `/coach/journal` — caseload-level private journal for the coach's own practice. Form + grouped-by-date list + recurring-theme sidebar. Entries feed the Coach Thought Partner context.
- `/coach-chat` (coach-primary variant) — loads coach_partner mode, sidebar filtered to coach_partner conversations only, auto-resumes most recent within 30 days or seeds a fresh caseload-level conversation. `?c=<id>` resumes a specific conversation. Learner-scoped and weekly-review variants are triggered by server actions (`startCoachPartnerSessionAction` / `startWeeklyReviewAction`) rather than URL params.
- `/learning` (coach-primary variant) — catalog browser + "Your coachees' progress" roll-up. Skips lesson-progress stamping + gate computation for coach viewers.
- `/community` (coach-primary variant) — cohort picker across every cohort they coach in + each cohort's alumni feed. Coaches post with the cohort they selected.
- `/messages` (coach-primary variant) — "Direct messages with your coachees" copy, coach-appropriate empty state. Thread header deep-links to `/coach/learners/[id]` when the other participant is their coachee, with a Thought-Partner-drafted "Check-in" button in the header row.

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
- `/super/course-builder`, `/super/course-builder/[id]`, `/super/course-builder/[id]/lessons/[id]` — Tiptap rich editor for courses (ConfirmBlock for course / module / lesson delete). Lesson editor has prereq picker (C1), cert-validity toggle (C5). Course detail has "Preview as learner" button (bypasses gate computation entirely for super_admin).
- `/super/course-builder/[courseId]/analytics` — Phase D1 per-course analytics: KPI row (enrolled / started / completed / median time-to-complete / quiet learners), biggest-drop callout, AI-engagement 2-up row (debriefs per completer + questions asked mid-lesson), per-lesson stacked bar chart with drop-off
- `/super/learning-paths`, `/super/learning-paths/[pathId]` — Phase C4 paths CRUD: create, edit courses + order, assign to cohort (auto-materializes into `cohort_courses`)
- `/super/certificates` — cross-org certificate log with revoke / restore
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
8. **Course builder foundations + quiz engine (LMS Phase A + B)**. Major push toward feature-parity with premium LMS tools (Lessonly, Docebo, Articulate Rise). Sized as two phases (A = foundations, B = rich content + quiz engine) shipped together. **Security + data integrity**: `lesson-viewer.tsx` now sanitizes Tiptap HTML server-side via `isomorphic-dompurify` with a strict allowlist before `dangerouslySetInnerHTML` — author content could carry paste-from-web scripts or event handlers. `lesson_progress_lesson_id_fkey` gained `ON DELETE CASCADE`, and the full delete chain (courses → modules → lessons → progress) cascades cleanly. `/api/course-content/upload` validates MIME allowlist + 50 MB cap + splits image vs material uploads. `lib/learning/video-embed.ts` replaces the naive `watch?v= → embed/` string replace with a provider-aware resolver (YouTube watch/shorts/youtu.be, Vimeo `/ID` and `/video/ID`, Loom share/embed), surfaces an amber error banner for unrecognized URLs, and adds `allow` flags to every iframe. **Author UX**: arrow-button reorder for modules and lessons (swap via `moveModule` / `moveLesson` server actions), cross-module move via `moveLessonToModule`, deep-clone via `duplicateCourse` (copies modules, lessons, quiz settings, quiz questions, linked resources — not learner attempts). Lesson gains `description` (short summary) + `duration_minutes` fields. Module gains learning-objectives editor (one per line, rendered as bullets to learners). Lesson editor gets a Lesson / Quiz type toggle, a linked-resources picker backed by the new `lesson_resources` junction table (unlinked via action), and a publish-time warning banner when modules are empty. Module edits now show explicit Saved/Error feedback. Tiptap gains tables (`@tiptap/extension-table` + row / cell / header), image upload prompts for alt text, responsive image sizing (`max-w-full h-auto` + `loading="lazy"`), YouTube/Vimeo/Loom inline embed via the new resolver. **Quiz engine**: `quiz_settings` (per lesson), `quiz_questions` (six types with Zod-validated per-type JSONB config), `quiz_attempts` (learner submissions with per-question grading). `QuizBuilder` component authors all six types (single-choice, multi-select, T/F, short-answer, matching, ordering) with per-option feedback, points, explanation, and inline reorder. `QuizPlayer` component renders the learner-facing quiz (shuffles questions if enabled, enforces `max_attempts`, shows per-answer feedback + explanation on submit, celebrates pass, offers retry on fail). Pass → auto-upsert to `lesson_progress.completed=true`. Fail → retry if attempts remain. `QuizAnalytics` panel on the author page shows total attempts, pass rate, avg score, and per-question correct-rate bars (lowest-first — rework candidates). **Learner experience**: lesson description + duration shown in the lesson header, module learning objectives shown on the course overview, course-complete celebration banner when 100% of lessons done, related-resources panel on the lesson page. Total course duration rolls up from lessons (falls back to module duration if lessons don't have estimates).

Bug fixes shipped alongside Phase 6:
- Invite confirmation flow: corrected `/auth/consume` path (was `/onboarding/consume`), fixed nested `?token=` encoding.
- `registerAction` only consumes invite when `email_confirmed_at` is set — SDK sometimes surfaces user object without session.
- Sign-out buttons no longer unmount mid-click via conditional-form + onClick pattern.

9. **LMS Phase C — paths, prereqs, certificates.** Shipped as five sub-phases (C1–C5) with a plan-approve-execute cadence.
   - **C1 prereqs.** `lesson_prerequisites` + `course_prerequisites` junction tables with recursive-CTE cycle-prevention triggers (reject any insert that would close a dependency loop). `src/lib/learning/access-gate.ts` is the single source of truth — `computeCourseLessonGates`, `computeCourseGates`, `computeSingleLessonGate` are used by BOTH lesson-page redirect logic AND lock-icon UI, so the gate renders identically in both places. Author UI: `prereq-picker.tsx` shared component used for both lessons + courses. Learner UI: lock icons with "Complete X first" hover + server-side redirect on bypass. PostgREST embed gotcha: `courses!course_prerequisites_required_course_id_fkey(title)` returns array, not object — normalized with `Array.isArray(v) ? v[0] ?? null : v`.
   - **C2 scheduled unlock.** Reused pre-existing `cohort_courses.available_from` / `available_until` date columns (no new schema). `updateCohortCourseSchedule` server action; inline date pickers in `assign-courses/course-assigner.tsx` matrix. Learner overview card shows "Unlocks on X" state.
   - **C3 soft due dates.** Added `cohort_courses.due_at date`. `src/lib/learning/due-status.ts` helper returns `DueStatus` (none/on_track/due_soon/overdue/complete) + label + chip class. `cohort-vitality.ts` gained `learnersOverdue` with optional cohortId arg so consultant + admin dashboards render the same overdue number.
   - **C4 learning paths.** `learning_paths` + `learning_path_courses (path_id, course_id, order)` + `cohort_learning_paths (cohort_id, path_id)`. Assigning a path to a cohort auto-materializes its courses into `cohort_courses` rows so the existing assignment machinery keeps working; path delete preserves the materialized rows so per-cohort edits aren't lost. Super UI: `/super/learning-paths` CRUD + `path-editor.tsx` for ordering courses. Learner UI: "Your path" card on `/learning` with current-course highlight.
   - **C5 certificates.** `certificates` table (one row per issuance — re-cert creates new row, never mutates). `courses.cert_validity_months` + `learning_paths.cert_validity_months` control expiry (null = never expires). `@react-pdf/renderer` for PDF generation — `pdf-template.tsx` is a React-PDF landscape A4 component with brand colors + Helvetica. `issue.ts` (idempotent `maybeIssueCertificate`), `render.ts` (dynamic-import @react-pdf/renderer → render buffer → upload to private Storage bucket → cache signed URL on the row), `on-completion.ts` (fire-and-forget hook from `markLessonComplete` + quiz pass). Storage bucket `certificates/` with per-user folder RLS (`storage.foldername = auth.uid()::text`). Super: `/super/certificates` log with revoke / restore.
   - **Key-conventions bugs surfaced + fixed during C shipping:**
     - Lessons silently not saving because `lessons.type` CHECK constraint allows only `{content, quiz}` but wrapper used literal `'lesson'`. Surfaced error state in save indicator; changed literal to `'content'`; added explicit return type `Promise<{ ok: true } | { error: string }>` to `updateLesson` so wrapper can no longer ignore `{ error }`.
     - Preview-as-learner 500 across Vercel: root cause was `isomorphic-dompurify` → jsdom → html-encoding-sniffer → `require('@exodus/bytes')` which is ESM-only, triggering ERR_REQUIRE_ESM on Vercel Node runtime. Fix: swapped `isomorphic-dompurify` for `sanitize-html` (pure JS, no DOM dep). Same commit dynamic-imported Tiptap + happy-dom to avoid module-load failures during the RSC render pass.
     - Super-admin preview showed lock UI despite bypassing redirects — fix was to skip gate computation entirely for super-admins, not just the redirect: `const courseGates = profile?.super_admin ? new Map<string, never>() : await computeCourseGates(...)`.
     - Defense-in-depth: added `if (!user) redirect('/login')` on all `/learning/*` pages to guard against Next 16 RSC streaming race.

10. **LMS Phase D — engagement + analytics.** Shipped as four sub-phases (D1–D4) with a competitive-differentiation lens: every piece leans on the contextual-AI moat peers can't match.
    - **D1 per-course analytics.** Added `lesson_progress.started_at timestamptz` + backfilled existing rows as `completed_at - 1m`. `src/lib/analytics/stamp-started.ts` is fire-and-forget on first lesson view. `src/lib/analytics/course-stats.ts` (`getCourseStats(supabase, courseId, cohortId?)`) is the shared helper — mirrors `cohort-vitality.ts` shape so super/admin/coach surfaces all render consistent numbers. Returns `CourseStats`: enrolled / started / completed / medianMinutesToComplete / per-lesson steps with drop-off / quietLearners / debriefsStarted / debriefsAmongCompleters / questionsAsked / questionsFlagged. `/super/course-builder/[courseId]/analytics` shows KPI row + biggest-drop callout + quiet-learner callout + per-lesson stacked bar chart (completed + in-progress, ordered by course position).
    - **D2 completion-celebration debrief mode.** New `debrief` AI mode (added to CHECK constraint + Zod enum + `MODE_PROMPTS`). Three-beat arc: what landed → where it maps → one concrete move. `startCourseDebrief(courseId)` creates a conversation with a Sonnet-generated opener grounded in the course + learner context. Course-complete banner on `/learning/[courseId]` has a "Debrief with thought partner →" CTA wired via inline server-component form with `action={async () => { "use server"; const { startCourseDebrief } = await import(...); await startCourseDebrief(courseId); }}`. New `course_debrief_pending` nudge pattern (10 patterns total now) fires 48h post-completion with 30-day cooldown, routed via special-case in `/coach-chat/from-nudge/[id]` that calls `startCourseDebrief` directly instead of the generic opener generator. Analytics page gains "N of Y completers debriefed" callout.
    - **D3 lesson notes + scroll resume.** `lesson_notes` table (unique (user_id, lesson_id)) + RLS (learner rw, coach/consultant/super read). `LessonNotes` panel collapsible with 1.5s debounce auto-save + flush-on-unmount + error surfacing. `lesson_progress.last_scroll_pct smallint 0..100` powers the `ScrollResume` chip ("Jump to where you left off") when ≥10%. **The differentiating move:** last 10 notes flow into `LearnerContext.lessonNotes` and render as a section between courseProgress and dailyChallenge — the thought partner picks up threads the learner flagged in lessons without them re-explaining. `evals/runner.ts` updated with `lessonNotes: []` in EMPTY_CONTEXT and buildContext merge.
    - **D4 ask-the-room Q&A.** `lesson_questions` table with per-exchange lifecycle (question → AI answer → optionally flagged-to-coach → optionally coach-response → resolved). `generateLessonAnswer` generates a grounded ~3-6 sentence answer via Sonnet — extracts lesson body with a pure-JS Tiptap walker, combines with learner context, with explicit no-fabrication instruction. `askLessonQuestion` is intentionally synchronous (the "ask the room" metaphor dies on async — sub-2s answer is the feel). `flagQuestionToCoach` notifies the coach (notifications table uses `type` + `link` columns, not `kind`/`link_url`; no org_id — Phase D4 trip-up). `LessonQuestions` component (ask card + prior questions with flag/resolve + status chips), `FlaggedQuestions` coach panel (waiting-first ordering + inline reply editor). Dashboard + learner detail show "N flagged questions" chip via `since-last-session.ts`. Analytics gets 2-up AI-engagement row: "Completers debriefed" + "Questions asked mid-lesson."

11. **Top-nav super dropdown grouping.** The super-admin dropdown had ballooned from Phase 7's expansion. Grouped into 5 sections — Portals / People & access / Content / Communication / Insights — via new `DropdownSection` + `MobileSection` primitives. "Admin Portal" renamed to just "Admin" for density.

### Coach portal rebuild (Phases 1–6)

A six-phase build that reshaped the coach experience from "learner portal with a coach dashboard tab" into a distinct, coach-native surface. Coaches are not learners here — product decision — so coach-primary users get their own nav, their own AI thought partner, their own thinking surfaces.

1. **Coach-shaped shell.** `src/lib/auth/role-context.ts` centralizes `coachPrimary` detection (coach membership, no learner membership, not org_admin/consultant/super). `(app)/layout.tsx` passes it into `TopNav`; coach-primary users get a coach-framed nav (Coaching Home · Journal · Learning · Community · Resources · Messages · Thought Partner) instead of the learner-framed one. `/dashboard` redirects coach-primary users to `/coach/dashboard`. Learning branches into `CoachLearningView` (catalog + coachees' progress roll-up; no progress bars, no gate computation, no lesson-started stamping). Community branches to scope across every cohort the coach coaches in, with a cohort picker. Messages and Resources fall through to the existing pages but with coach-appropriate copy.
2. **Coach Thought Partner mode.** `ai_conversations.mode` CHECK constraint gains `coach_partner`. New `COACH_PARTNER_PROMPT` replaces PERSONA entirely (addresses the coach, references coachees in third person). New `buildCoachContext` replaces `buildLearnerContext` with two shapes: caseload overview (default) and learner-scoped deep-dive (when `context_ref.learnerId` is set). Tool set is narrow — only `log_coach_note`, which writes to `coach_notes` with `is_coach_of` ownership backstop. Entry points: "Plan your week" CTA on Coaching Home (caseload), "Think this through with Thought Partner →" button on `/coach/learners/[id]` (learner-scoped). Coach-primary sidebar at `/coach-chat` filters to `coach_partner` conversations only; bare `/coach-chat` landing seeds a caseload-level conversation for the coach.
3. **Coaching Home rebuild.** Replaced the learner-grid hero with a caseload-level view. `src/lib/coach/caseload-pulse.ts` aggregates pulse metrics (active · on a sprint · flagged Q's · overdue items · quiet 14d+) and builds a priority queue ordered by urgency: flagged questions → overdue action items → overdue recap (active sprint + no recap in 14d) → quiet coachee → new assignment. Tone colors (pink = act now, amber = worth a look) only appear when count > 0. Empty queue renders a green "nothing urgent" panel, not an empty card. The searchable learner grid moved below a "Full caseload" divider.
4. **AI session-prep draft + transparency copy.** New `generateSessionPrepDraft` (`src/lib/coach/prep-draft-action.ts`) produces a forward-looking prep doc grounded in since-last-recap activity — three unmarked beats: what's alive · worth opening up · don't forget. Ephemeral by design: the `PrepDraftPanel` on `/coach/learners/[id]` offers Regenerate/Copy/Close but no Save. The recap tool (already existing) handles the post-session persistent artifact. Intake opener + `/profile` rewrite: replaces the vague "your coach doesn't see this conversation" bullet with explicit two-part framing — data you add is coach-visible (the whole point); chats stay between you and the Thought Partner.
5. **Journal + weekly review.** New `coach_journal_entries` table (caseload-level, distinct from the learner-scoped `coach_notes`). RLS scoped to the coach; org_admin does NOT read journal entries (unlike `coach_notes` which is org_admin-readable). New `/coach/journal` route with form + grouped-by-date list + recurring-theme sidebar. Last 10 entries inject into `CoachContext` so the coach's own voice carries between conversations. Journal link added to the coach top nav between Coaching Home and Learning. **Weekly review** is a coach_partner conversation variant with `context_ref.kind = "weekly_review"` — opener frames a three-beat Sunday-thinking ritual (what happened · what's underserved · what's the plan). New `startWeeklyReviewAction`; card on Coaching Home alongside the Plan-your-week card.
6. **Communication polish.** `/messages` copy reframed for coach viewers ("Direct messages with your coachees"). Thread header deep-links to `/coach/learners/[id]` when the other participant is the viewer's coachee. New `CheckInDraftButton` on the thread page (coach-only) generates a 2-4 sentence warm check-in grounded in recent learner activity via `generateCheckInDraft`, surfaced inline in an editable textarea, sent via the existing `sendMessage` (Realtime subscription renders the insert).

Cross-cutting patterns from the rebuild:
- **`getUserRoleContext` is the single authority** for coach-primary detection. Every new coach-facing branch should call it rather than re-deriving from memberships.
- **Ephemeral AI drafts over persistent ones.** Prep / check-in / recap drafts are all returned as text the coach edits and decides what to do with. No silent writes.
- **`log_coach_note` only.** When adding new coach-side tools, think carefully about whether exposing them in `coach_partner` mode would let the AI write to a coachee's record without the coach explicitly choosing it.
- **Seeded openers apply to coach_partner too.** The coach never lands on a blank coach_partner chat — the three entry points all seed.

Deferred (Phase 5b / future):
- Memory distillation scoped to `coach_partner` conversations (currently runs but lands against learner-memory types that don't fit coaching-style facts).
- Pattern cards on Coaching Home ("3 coachees have stalled sprints", "2 coachees debriefed a capstone this week"). Deferred because the priority queue already surfaces individual signals; a meta-pattern layer risked being noisy without more caseload maturity.
- More coach tools: `draft_session_prep` (tool, not just button), `suggest_action_item`, `summarize_caseload_pattern`. Phase 2 intentionally shipped only `log_coach_note` to keep the surface area small.

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

**Immediately up next — LMS Phase E: practice scenarios.** The single feature that wins a bake-off against Lessonly. Peers bolt AI onto generic grading; ours is contextual — the thought partner already knows the learner's goals, sprints, assessments, memory facts, and capstone arc, so its first-pass feedback on a practice response lands in a way no other platform's can.

Suggested shape:

1. **New `practice` lesson type.** Extends the existing `lessons.type` CHECK constraint (currently `content` / `quiz`) to add `practice`. Mirrors the quiz engine's pattern: `practice_settings` 1:1 with the lesson (prompt text, rubric JSONB, max_attempts, media_kind `video` | `audio` | `either`, max_duration_seconds), `practice_submissions` (learner rows with media URL + transcript + AI draft feedback + coach review + rubric scores).
2. **Learner capture.** Browser-native `MediaRecorder` API to capture webcam/mic in the lesson viewer — no third-party SDK. Upload to Supabase Storage (new private `practice-submissions/` bucket with per-user folder RLS). Generate a transcript server-side via Whisper (OpenAI or Anthropic's upcoming alternative — pick based on cost/latency when we spike this). Preview playback before submit.
3. **AI-drafted first-pass feedback — the moat.** On submission, fire-and-forget job calls Sonnet with: the rubric, the transcript, the lesson body, AND the learner's full `LearnerContext` (goals, active sprint, assessments, memory facts). Returns per-rubric-criterion commentary + an overall "what worked / what to try next" paragraph. Store as `practice_submissions.ai_draft` JSONB. The coach gets this as a pre-filled draft they can edit before publishing — not auto-posted.
4. **Coach review surface.** New panel on `/coach/learners/[id]` shows pending submissions, inline video player, rubric form pre-filled from `ai_draft`, "Publish feedback" action that notifies the learner and stamps `reviewed_at`.
5. **Learner feedback view.** Post-review, the lesson page shows the coach's rubric scores + feedback + "Reflect on this with thought partner →" CTA that spawns a reflection-mode or debrief-style conversation grounded in the submission + feedback.
6. **Analytics.** `course-stats.ts` extended with `practiceSubmissionsPending` (awaiting coach review) + `practiceMedianReviewDays`. Coach dashboard gets "N practice submissions awaiting review" chip.

Open design questions for Phase E:
- Whisper vendor (OpenAI vs Anthropic's audio API when it's GA). Default: OpenAI for now with a thin `transcribe()` interface so we can swap later.
- Storage cost: practice videos can be big. Enforce max_duration_seconds strictly on client + server, consider background re-encoding to `.webm` vp9 if bandwidth becomes an issue.
- Do we let learners see the AI draft directly, or only via coach-curated feedback? **Default: only via coach.** The whole point is a human-in-the-loop rubric — exposing the raw AI draft turns it into "graded by a bot."

**LMS Phase F — enterprise hygiene** (last, ship per-client demand):
- Lesson version history with diff + rollback (super can see the draft trail and restore a prior version).
- Approval workflows (`courses.status`: `draft` → `in_review` → `published`, with reviewer assignment).
- Scheduled publish (a course flips `draft` → `published` at a timestamp).
- Template library — pre-built course skeletons super can clone from on create.
- Multi-author collaboration guardrail (soft lock on the lesson editor, or a last-write-wins banner when another author edited since load).
- SCORM 1.2 / 2004 import + launch (optional; only if an enterprise client demands it — non-trivial engineering, worth scoping only when named).

Near-term candidates (not LMS-track):
- **Test coach portal end-to-end with a real coach.** Phases 1–6 verified via typecheck + preview compile only. Need a signed-in coach to pressure-test the full flow: Coaching Home, Journal, coach_partner conversations (caseload + learner-scoped + weekly review), prep / check-in drafts, the updated Community cohort picker.
- **Coach portal Phase 5b — memory distillation + pattern cards.** Scope the memory distiller to read `coach_partner` conversations distinctly and store facts typed for coaching style (current types lean learner-facing). Pattern cards on Coaching Home (stalled sprints cluster, cross-caseload reflection themes, capstone-debrief surge) — deferred from Phase 5 because the priority queue covers individual signals well enough to start.
- **Coach portal Phase 2b — more tools.** `draft_session_prep`, `suggest_action_item`, `summarize_caseload_pattern`, `log_coach_journal` as tools inside coach_partner mode (not just buttons). Each needs careful thought about whether the Thought Partner calling them silently matches the product boundary; exposing them as approval-gated would be safer.
- **Run the first `pnpm eval` baseline** — critical before further prompt tuning. coach_partner mode has no eval fixtures yet.
- **Drop `goals.active_focus_until`** — DB column is dead weight, remove in a small follow-up migration.
- **Capture recent MCP migrations as `.sql` files** — back-fill `supabase/migrations/` with the last dozen MCP-applied migrations so they're replayable in preview / dev environments.
- **Wire custom SMTP in Supabase Dashboard** (Resend or SendGrid) — built-in email is rate-limited even on Pro.
- **Capstone PDF export** — once we have PDF rendering wired for certs, reuse it.
- **Expose member emails in admin/people** — currently blank because org_admin RLS can't read `auth.users.email`. Need a view or RPC.
- E2E tests (Playwright); CI integration for `pnpm eval`; Production-conversation replay for evals.

Later / bigger:
- Semantic search over memory facts (pgvector) — if top-N starts missing relevance.
- Voice + multi-modal in thought-partner chat (PWA polish, browser speech API, image upload).
- Coach/consultant/admin rollup views for sprint progress + goal arcs across a cohort.
- Cohort program-dates model — workshop dates, peer-group dates on `cohorts` so learners see the full program schedule.
- Cross-cutting polish pass (mobile, a11y, brand consistency, loading/error states across the full app).
