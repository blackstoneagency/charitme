# CharitMe — Handoff Log

> Continuously updated coordination doc. Each workstream records what it owns,
> what it changed, and what the next agent needs. Newest entries on top.

## File / workstream ownership

| Agent | Workstream | Branch | Owned Directories | Shared Files (Agent 0 only) | Status |
|-------|-----------|--------|-------------------|------------------------------|--------|
| 0 | Orchestration / integration | `agent/orchestration` | root docs (`todo.md`, `handoff.md`, `architecture.md`, `decisions.md`) | `package.json`, lockfiles, `app/layout.tsx`, `globals.css`, env schema, routing | Active |
| 1 | Supabase / data / security | `agent/supabase` | `supabase/migrations/**`, `lib/supabase*.ts`, `lib/roles.ts` | RLS policies, generated types | Not started |
| 2 | Campaigns / organizer | `agent/campaigns` | `app/create/**`, `app/dashboard/campaigns/**`, `app/campaigns/**`, `app/api/campaigns/**` | — | Not started |
| 3 | Payments / payouts | `agent/payments` | `app/api/stripe/**`, `app/api/donations/**`, `app/api/payouts/**`, `lib/stripe.ts`, `lib/payment-*.ts`, `lib/pricing.ts` | `@shared/fees` | Not started |
| 4 | Donor / discovery / social | `agent/donors` | `app/donor/**`, `app/donors/**`, `app/leaderboard/**`, `app/api/saved-campaigns/**`, `lib/gamification.ts`, `lib/leaderboard.ts`, `lib/referrals.ts` | — | Not started |
| 5 | Nonprofits / corporate / grants / sponsors / volunteers | `agent/nonprofits` | `app/beneficiary/**`, `app/sponsors/**`, `app/api/sponsors/**`, `app/api/beneficiaries/**`, `lib/employer-matching.ts` | — | Not started |
| 6 | AI / marketing automation | `agent/ai-marketing` | `app/api/ai/**`, `app/admin/marketing/**`, `lib/ai-platform.ts`, `lib/openai.ts`, `lib/marketing-*.ts`, `lib/organizer-marketing.ts` | AI provider abstraction | Not started |
| 7 | Trust / safety / compliance | `agent/trust-safety` | `app/api/admin/trust/**`, `app/api/campaign-reports/**`, `lib/risk.ts`, `app/trust-safety/**`, `app/privacy/**` | RLS policies | Not started |
| 8 | UX / design system / mobile / a11y | `agent/mobile-design` | `components/**`, `app/globals.css`, marketing pages | `globals.css`, `layout.tsx` (coordinate w/ Agent 0) | Not started |
| 9 | Admin / analytics / QA / observability | `agent/admin-qa` | `app/admin/**`, `app/api/admin/**`, `__tests__/**`, `e2e/**`, `lib/payment-admin-data.ts` | test config | Not started |

## Entries

### 2026-07-19 — Events product surface (on existing fundraising_events model)
- **Gap**: `fundraising_events` / `event_tickets` / `event_registrations` already existed
  (competitor-parity migration) but had **no organizer column, no check-in table, and no
  UI/API**. Built the product surface on top rather than new tables.
- **Migration** `20260720000000_events_platform.sql` (additive + idempotent): adds
  `created_by` / `description` / `capacity` / `cover_image_url` to `fundraising_events`;
  new `event_checkins` table; owner-scoped RLS on events + registrations + check-ins.
- **Logic** `lib/events-core.ts` (capacity, upcoming, registration-open, slug, schemas) +
  `lib/events.ts` (data access, registered-qty counts, attendee lists).
- **API**: `/api/events` (GET/POST), `/api/events/[id]` (GET/PATCH), `.../register` (free RSVP,
  capacity-checked), `.../registrations` (organizer), `/api/events/registrations/[id]/checkin`
  (organizer toggle).
- **UI**: `/events` (discovery), `/events/[slug]` (detail + RSVP), `/events/manage`
  (host + attendees + check-in). Footer link added.
- **Scope**: v1 is **free RSVP**; paid ticketing via Stripe checkout is a documented
  follow-up (no dead pay button rendered). 17 tests. Gates: typecheck ✓, vitest 456/456 ✓,
  build ✓ (all routes emit), no new lint warnings.

### 2026-07-19 — Sponsorships + Privacy + Matching slices (rebased onto master)
- **Context**: this branch (`claude/charitme-github-integration-njok43`, PR #11) originally
  also built volunteers + grants, but master independently shipped canonical, production-
  applied volunteers/grants (CHAR-0001..0004). To avoid duplicate/conflicting tables, this
  branch was **rebased onto latest master and its own volunteers/grants were dropped** —
  master's versions are authoritative. Only the three genuinely-net-new slices remain.
- **Sponsorships** (net-new): `sponsorship_opportunities`, `sponsorship_requests` + RLS;
  `lib/sponsorships*.ts`; `/api/sponsorships/**`; `/sponsor{,/[id],/manage}`. Two-sided
  offers with live funding progress. 18 tests.
- **Privacy (GDPR/CCPA)** (net-new): `privacy_requests` (+ partial-unique active index) + RLS;
  real self-serve data export (`/api/privacy/export`) + deletion requests with admin
  fulfillment (PII anonymization, txns retained); `/privacy-center`, `/admin/privacy`.
  Export reads master's `volunteer_applications.applicant_user_id` / `grant_applications.applicant_user_id`. 13 tests.
- **Corporate matching** (net-new): `matching_programs`, `matching_claims` + RLS; capped
  match computation; `/api/matching/**`; `/matching{,/[id],/manage}`. 24 tests.
- **Shared files touched** (Agent-0 coordinate): `components/AppShell.tsx` (footer links),
  `components/CharitMeApp.tsx` (admin nav: Privacy Requests), `supabase/schema.sql` (3 DDLs appended).
- **Migrations** (not yet applied to prod): `20260716000000_sponsorships.sql`,
  `20260718000000_privacy_requests.sql`, `20260719000000_matching_gifts.sql`. Additive + RLS-first.
- **Gates**: typecheck ✓, vitest 439/439 ✓, `next build` ✓ (all routes emit), no new lint warnings.

### 2026-07-19 — Agent 5 — Admin grants UI + Volunteers pillar + RLS audit
- **Admin grants management** (`master` 2fedeef): `/admin/grants` + `/api/admin/grants` (GET/POST) + `/api/admin/grants/[id]` (PATCH/DELETE), admin-gated. Create/edit/publish/close/delete grants; new grants go live on `/grants` immediately. Sidebar "Grants" added to dashboard + admin.
- **RLS audit** (live prod): 78 public tables, **0 with RLS disabled**. 17 `marketing_*` tables are deny-all-except-service-role (correct for admin-only data). Posture sound. Follow-up: explicit admin policies on marketing tables (defense-in-depth) + per-persona test harness.
- **Volunteers pillar** (`master` d82e89b): full vertical mirroring grants — 3 tables (RLS applied + verified in prod), lib + scorer, 4 API routes, `/volunteer` discovery + detail + apply, `/dashboard/volunteer` tracker, 11 tests. Gates green (363 tests, build).
- **Verification note**: migrations applied to LIVE Supabase via Management API (idempotent). Read paths verify against prod; authed write paths (apply/submit/withdraw) still need a real logged-in session to certify — no fake prod data created.
- **Next candidates**: admin volunteer-opportunities UI (mirror admin grants); Events or Impact pillar; per-persona RLS test harness; grant/volunteer seed of real data (owner-provided).

### 2026-07-19 — Agent 0/1 — Environment wired + grants verified in production
- **Env configured**: `apps/web/.env.local` cleaned & validated (owner pasted real credentials). Earlier local 500s were caused by malformed env (leading spaces after `=`), NOT missing network. Sandbox **can** reach Supabase (Node fetch → 200/401 in ~0.1s).
- **Migration applied to LIVE Supabase** (project `yanexccimwooursawynm`) via Management API query endpoint (`POST https://api.supabase.com/v1/projects/{ref}/database/query`, `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`). Additive + idempotent, so safe. **This is how future migrations can be applied headlessly** (token lives in `.env.local`, do not print it).
- **Verified in production**: 5 grant tables live, RLS on all, policies 3/2/1/1/1; anon read of `grants` = 200, anon read of `grant_applications` = 0 rows (isolation OK). `GET https://www.charitme.com/api/grants` → 200; `?limit=999` → 400 zod error.
- **Important caution for all agents**: verification now runs against **PRODUCTION** Supabase (no separate staging). Reads are safe; **do not** write test/fake rows into prod (respect "no fake production data"). Payment testing must use Stripe **test** keys — the configured Stripe keys are **LIVE**.
- **Security**: live secrets were pasted in chat + previously in `DANIEL_ENV.txt`. Owner advised to rotate Stripe secret/restricted, Supabase service-role, DB password, Resend, Google OAuth secret, and the access token. Nothing secret was committed (`.env.local`/`.env` are gitignored; verified).
- **Follow-up**: `/grants` shows an empty state until real grants are added (via admin `POST /api/grants` or a seed of real opportunities). No dashboard sidebar link yet.

### 2026-07-19 — Agent 5/1 — Grants platform vertical slice (CHAR-0001/0002)
- **Branch**: `agent/grants` (off `agent/orchestration`). Commit `c55f246`.
- **Completed**: Full Grants domain — schema+RLS, typed lib, 6 API routes, 3 mobile-first pages, 13 unit tests. Gates green (typecheck, 352 tests, `next build`).
- **Files added**: `supabase/migrations/20260719000000_grants.sql`; `apps/web/lib/grants.ts`, `apps/web/lib/grants-server.ts`; `apps/web/app/api/grants/**`, `apps/web/app/api/ai/grant-match/route.ts`; `apps/web/app/grants/**`, `apps/web/app/dashboard/grants/**`; `apps/web/__tests__/grants.test.ts`.
- **Design notes**: matching scorer is pure/deterministic (unit-tested) and doubles as the AI-unavailable fallback (mirrors `lib/openai.ts` `fallback*`). API routes use `supabaseAdmin` + explicit per-handler authz (RLS is defense-in-depth). Detail layout uses flex-wrap (no shared `globals.css` change). Applications have guarded status transitions (draft→submitted→withdrawn; edits draft-only).
- **needs-staging**: `grants` tables must be created by running the migration against Supabase; until then `/grants` renders an empty state gracefully and API calls error cleanly (no crash, no build dependency). Live RLS + application-lifecycle verification requires staging (ADR-0003).
- **Follow-ups for next agents**: (8) add "Grants" to the dashboard sidebar nav in `components/CharitMeApp.tsx`; (5) grant_documents upload UI + grant seed data; (6) optional AI enrichment atop the deterministic ranker; (1/7) RLS test suite once staging exists.
- **Heads-up (not mine)**: working tree also shows a modified `.env.example` and an untracked `DANIEL_ENV.txt` at repo root from another session — left unstaged; `DANIEL_ENV.txt` may contain secrets and should not be committed.

### 2026-07-19 — Agent 0 — Phase 1 audit + coordination scaffolding
- **Completed**: Full repo audit. Established real baseline (see `architecture.md`): 102 pages, 138 API routes, 41 migrations, ~80 wired Supabase tables, 339 tests passing, type-clean. Created `architecture.md`, `handoff.md`, `decisions.md`, restructured `todo.md` into an execution tracker.
- **Files changed**: `architecture.md`, `handoff.md`, `decisions.md`, `todo.md` (root, docs only — no app code).
- **Key finding for all agents**: The platform is **already largely built and healthy** — this is a hardening/gap-closure/elevation program, not a greenfield build. Do NOT rewrite working subsystems. Find genuine gaps, close them as verified vertical slices.
- **Blocker for all agents**: Dev sandbox **cannot reach live Supabase** (short/placeholder keys; data routes 500 locally). "Tested end-to-end / real donations" verification requires a **staging Supabase project + Stripe test keys**. Until then, verification is limited to typecheck, unit/integration tests (Vitest with mocked Supabase), build, and static UI/responsive checks.
- **Prior recent work on `master`** (context): dark-mode default, hero floating-card nudge, state business-license lead connectors, New Customers outreach tab.
- **Remaining**: Await prioritization of the gap backlog (see `todo.md` §Execution Backlog).
