# CharitMe — Execution Tracker

> **Agent 0 owns this file.** It is the living source of truth for the
> production-readiness program. Section A is the actionable engineering backlog.
> Section B (further down) is the competitive product vision it serves.

## Status legend
`Not Started` · `In Progress` · `Blocked` · `Code Complete` · `Testing` · `Verified` · `Production Ready`

A task reaches **Verified** only with real evidence (test name, route, Supabase
record, screenshot, commit). Per **ADR-0003**, tasks touching live data / Stripe /
payouts / RLS cannot exceed `Code Complete` from the current sandbox — they are
tagged `needs-staging` until a staging Supabase + Stripe test project is available.

## Audit baseline (2026-07-19)
Platform is **already mature and healthy**: 102 pages, 138 API routes, 41 migrations,
~80 wired Supabase tables, 339 passing tests, type-clean build. This is a
**gap-closure + hardening + elevation** program, not a rebuild (ADR-0001).

## Gap analysis — genuinely absent/thin domains
Cross-referencing the required table inventory against tables actually referenced in code:

| Domain | State today | Evidence |
|--------|-------------|----------|
| **Grants** | Absent | no `grants/grant_*` tables referenced in code |
| **Volunteers** | Absent | no `volunteer_*` tables referenced |
| **Events** | Absent | no `events/event_*` tables referenced |
| **Corporate giving** | Thin | `lib/employer-matching.ts` exists; no `corporate_accounts/_members` tables |
| **Sponsorship workflow** | Thin | `sponsors` table exists; no `sponsorship_opportunities/requests/agreements` |
| **Formal impact tracking** | Partial | `transparency_ledger_items` exists; no `impact_plans/updates/evidence/metrics` |
| **Subscriptions / entitlements** | Absent | no `subscriptions/entitlements/invoices` tables |
| **Gamification (persisted)** | Partial | `lib/gamification.ts` exists; no `badges/user_badges/challenges` tables |

Well-covered already (do not rewrite): auth, campaigns, donations, payments &
payment-observability, payouts, recurring, refunds, trust/risk, marketing engine,
AI platform, admin, lead-gen.

---

# Section A — Execution Backlog

> Seeded with the highest-value real gaps + hardening. Each new domain lands as a
> vertical slice: migration (RLS-first) → typed lib → API (authz) → mobile-first UI
> → tests → docs. IDs are stable; statuses advance with evidence.

- [x] CHAR-0001 — **Verified in production** (schema + RLS applied to live Supabase 2026-07-19)
  - Area: Grants
  - Feature: Grants data model + RLS
  - Description: Migration for `grants`, `grant_matches`, `grant_applications`, `grant_documents`, `grant_deadlines` with FKs, indexes, timestamps, soft-delete, and RLS (public read of open grants; org-scoped applications).
  - Agent: 1 (+5)
  - Priority: P1
  - Dependencies: none
  - Database: new tables + RLS
  - API: none (this task)
  - UI: none (this task)
  - Security: RLS tenant isolation for applications (applicant-scoped policies written)
  - Tests: RLS verified in prod — all 5 tables `rowsecurity=true`; anon read of `grant_applications` returns 0 rows (owner isolation holds); anon read of `grants` returns 200 (public policy). Per-persona organizer-vs-organizer test still pending real sessions.
  - Completion Evidence: migration applied via Supabase Management API (HTTP 201); pg_class shows grants/grant_deadlines/grant_matches/grant_applications/grant_documents with RLS + policies (3/2/1/1/1); anon isolation confirmed.
  - Commit: c55f246

- [~] CHAR-0002 — **Read path Verified in production**; authed write paths Code Complete (need a real user session to certify)
  - Area: Grants
  - Feature: Grant discovery + AI matching + application workflow
  - Description: `/grants` discovery (debounced search/filter), application drafts with submission/withdraw + guarded status transitions; `/api/ai/grant-match` deterministic ranker (AI-fallback pattern).
  - Agent: 5 (+6 for AI)
  - Priority: P1
  - Dependencies: CHAR-0001
  - Database: reads CHAR-0001 tables
  - API: `/api/grants` (GET/POST), `/api/grants/[id]`, `/api/grants/[id]/apply`, `/api/grants/applications` (GET), `/api/grants/applications/[id]` (GET/PATCH/DELETE), `/api/ai/grant-match`
  - UI: `/grants`, `/grants/[slug]`, `/dashboard/grants` (mobile-first)
  - Security: server-side authz per handler (auth via supabase-server; admin gate on POST); status-transition guards
  - Tests: 13 unit tests (scorer + zod schemas) **passing**; production read/validation verified (see below); authed apply/submit/withdraw lifecycle still needs a real logged-in session to certify
  - Completion Evidence: `__tests__/grants.test.ts` 13/13 pass; **PROD** `GET https://www.charitme.com/api/grants` → 200 `{grants:[],total:0}`; `?limit=999` → 400 zod error; `?q=health` → 200; `next build` compiled all 8 grants routes
  - Commit: c55f246
  - Follow-ups: sidebar nav entry (shared `CharitMeApp` nav — Agent 8); grant_documents upload UI; grant seed data; AI provider enrichment layer on top of deterministic ranker

- [x] CHAR-0003 — **Verified in production** (schema + RLS applied to live Supabase 2026-07-19)
  - Area: Volunteers
  - Feature: Volunteer data model + RLS
  - Description: `volunteer_opportunities`, `volunteer_profiles`, `volunteer_applications` (skills as `text[]` with GIN indexes; shifts/hours folded into applications for v1) with RLS.
  - Agent: 1 (+5)
  - Priority: P1
  - Database: new tables + RLS applied via Management API
  - Security: public read of open opportunities; opt-in public volunteer profiles; applicant-scoped applications; anon read of `volunteer_applications` returns 0 rows (isolation verified)
  - Tests: RLS verified (all 3 tables `rowsecurity=true`, policies 3/2/1); per-persona harness pending
  - Completion Evidence: migration `20260719010000_volunteers.sql` applied (HTTP 201); pg_class RLS check passed
  - Commit: d82e89b
  - Follow-ups: separate `volunteer_shifts`/`volunteer_hours` tables; opportunity-owner review access to applications; volunteer_profiles editor UI

- [~] CHAR-0004 — **Code Complete** (read path deploys to prod; authed writes need a real session to certify)
  - Area: Volunteers
  - Feature: Volunteer marketplace + matching + hours tracking
  - Description: Opportunity discovery/search/filter (remote), idempotent apply, application tracking + withdraw, deterministic skill-match scorer (AI-fallback).
  - Agent: 5 (+6)
  - Priority: P2
  - Dependencies: CHAR-0003
  - API: `/api/volunteers/opportunities` (GET/POST), `/api/volunteers/opportunities/[id]/apply`, `/api/volunteers/applications` (GET), `/api/volunteers/applications/[id]` (PATCH withdraw)
  - UI: `/volunteer`, `/volunteer/[slug]`, `/dashboard/volunteer` (mobile-first) + sidebar nav
  - Tests: 11 unit tests (scorer + schemas + slots) passing; `next build` compiled all routes
  - Completion Evidence: 363 tests pass; typecheck clean; build green
  - Commit: d82e89b
  - Follow-ups: admin opportunities management UI (mirror admin grants); hours logging + verification UI; AI matching enrichment

- [ ] CHAR-0005
  - Area: Events
  - Feature: Events data model + RLS
  - Description: `events`, `event_registrations`, `event_tickets`, `event_checkins` with capacity/waitlist constraints + RLS.
  - Agent: 1
  - Priority: P2
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0006
  - Area: Events
  - Feature: Event pages, registration, ticketing, QR check-in
  - Description: Event pages, free/ticketed registration reusing Stripe checkout, attendee management, QR check-in, event-linked campaigns.
  - Agent: 2 (+3 for ticketing)
  - Priority: P2
  - Dependencies: CHAR-0005, payments infra
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0007
  - Area: Impact tracking
  - Feature: Formal impact plans/updates/evidence/metrics
  - Description: `impact_plans`, `impact_updates`, `impact_evidence`, `impact_metrics` layered onto existing `transparency_ledger_items`; public impact dashboard + donor impact feed; AI impact summaries.
  - Agent: 2 (+6)
  - Priority: P1
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0008
  - Area: Corporate giving
  - Feature: Corporate accounts + matching-gift workflow
  - Description: `corporate_accounts`, `corporate_members`, match rules/limits/approval routing; extend `lib/employer-matching.ts`; CSR dashboard.
  - Agent: 5
  - Priority: P2
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0009
  - Area: Sponsors
  - Feature: Sponsorship opportunity → request → agreement workflow
  - Description: `sponsorship_opportunities`, `sponsorship_requests`, `sponsorship_agreements`; proposals, packages, fulfillment tracking, AI sponsor matching.
  - Agent: 5 (+6)
  - Priority: P3
  - Dependencies: existing `sponsors`
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0010
  - Area: Monetization
  - Feature: Subscriptions + entitlements + billing portal
  - Description: `subscriptions`, `subscription_items`, `entitlements`, `invoices`; Stripe Billing; feature-flag/entitlement gating for premium analytics/CRM/marketing/AI.
  - Agent: 3 (+9)
  - Priority: P2
  - Dependencies: Stripe (needs-staging)
  - Security: entitlement checks server-side
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0011
  - Area: Gamification
  - Feature: Persist badges/challenges/leaderboard state
  - Description: `badges`, `user_badges`, `challenges`, `challenge_participants`; wire `lib/gamification.ts` to DB instead of computed-only.
  - Agent: 4
  - Priority: P3
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0012 — **Audit done (posture sound)**; automated per-persona tests pending
  - Area: Security / hardening
  - Feature: RLS coverage audit + automated RLS tests
  - Audit result (2026-07-19, live prod): 78 public tables; **0 with RLS disabled** (no raw exposure). 17 `marketing_*` tables are RLS-enabled with no policies = deny-all except service role (correct for admin-only data accessed via `supabaseAdmin`). 61 tables have explicit policies. Follow-up (defense-in-depth, non-urgent): add explicit admin-scoped policies to the 17 marketing tables so intent is documented in-schema. Automated per-persona RLS test harness still to build.
  - Description: Enumerate every user-accessible table, confirm RLS enabled + policies, add automated per-persona RLS tests (unauth, donor, organizer, nonprofit admin, corporate admin, T&S, finance, support, super admin).
  - Agent: 1 (+7)
  - Priority: P0
  - Dependencies: none
  - Security: core
  - Tests: RLS matrix (needs-staging for live verification)
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0013
  - Area: Security / hardening
  - Feature: Env validation + secret-exposure audit + security headers/CSP
  - Description: Zod-validated env schema at boot; audit that no service-role/Stripe/AI secrets reach client bundles; add CSP + security headers; confirm rate-limiting coverage (`lib/rate-limit.ts`).
  - Agent: 1 (+9)
  - Priority: P0
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0014
  - Area: QA / observability
  - Feature: E2E smoke suite across personas + Playwright wiring
  - Description: Playwright smoke tests for register→create→donate→payout→admin against staging; expand from current e2e footprint.
  - Agent: 9
  - Priority: P1
  - Dependencies: staging env (needs-staging)
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0015
  - Area: Mobile / a11y
  - Feature: Full responsive + WCAG 2.2 AA sweep
  - Description: Verify every primary flow at 320–1920px and against axe; fix overflow, tap targets, focus order, labels, contrast, reduced-motion. (Ongoing; dark-mode default + hero-card fixes already landed.)
  - Agent: 8
  - Priority: P1
  - Dependencies: none
  - Completion Evidence: dark-mode default (commit d32bb02); hero card nudge (commit 1f5a6fe)
  - Commit: (in progress)

- [ ] CHAR-0016
  - Area: Infra
  - Feature: Staging environment + verification unblock
  - Description: Stand up a staging Supabase project + Stripe test keys so data/payment/payout/RLS/webhook flows can be truly verified (unblocks the `needs-staging` tag across the backlog).
  - Agent: 0 (requires user/owner action for secrets)
  - Priority: P0
  - Dependencies: user provides staging credentials
  - Completion Evidence: —
  - Commit: —

> Backlog continues: each remaining capability in Section B becomes CHAR-#### tasks
> as its slice is scheduled. Completed tasks move to **Section C — Completed** with evidence.

---

# Section C — Completed (with evidence)

- [x] Dark mode as default theme — commits `d32bb02`, `8267f29`; verified: `data-theme=dark` with no stored pref, light toggle preserved, no mobile overflow.
- [x] Hero floating stat-card visibility nudge — commit `1f5a6fe`; verified: cards 78px inside viewport at 1360px, reset to `right:0` on mobile.
- [x] Product TODO/roadmap from competitive audit — commit `54efa25`.

---

# Section B — Competitive Product Vision

Master list of everything CharitMe is building to become a world-class,
AI-first alternative to GoFundMe. Checkboxes track build status:
`[x]` = shipped, `[ ]` = planned.

> The competitive tables in sections 1–3 are the **aspirational roadmap**
> (what "world-class" looks like). The **audited status** below reflects what
> is actually implemented in the codebase today, based on a route/page-level
> audit — not marketing aspiration. Baseline health as of this audit:
> typecheck ✅, lint ✅ (0 errors), **339/339 unit tests ✅**, production
> build ✅ (118 pages).

---

## 0. Audited Implementation Status

Legend: **Built** = real page/route wired to Supabase exists and compiles;
**Partial** = core exists, depends on an unconfigured provider or is thin;
**Missing** = no implementation found.

### Built (verified present in codebase)
- **Auth**: email login/signup, password reset, OAuth callback, MFA page,
  session-cookie middleware, protected-route guard.
- **Campaigns**: create/edit/publish, updates, milestones, FAQs, rewards/tiers,
  ledger, supporters, team members, co-organizers, beneficiary invites,
  thank-donors, share tools, QR poster, embed widget, reports, categories.
- **Donations**: guest + registered checkout (Stripe), recurring (create/
  pause/cancel), receipts, refund requests, offline donations, donor wall.
- **Payments/Payouts (admin)**: Stripe Connect onboarding + status, payouts,
  refunds, disputes, reconciliation, processors, campaign payment flows,
  webhook handler.
- **Donor experience**: donor dashboard, donation history, saved/followed
  campaigns, recommended campaigns, receipts, donor profiles.
- **Discovery**: campaign search/filters, categories, leaderboards
  (campaigns + donors), success stories, sponsor bar.
- **AI suite**: campaign writer, coach, goal-recommend, content/rewrite,
  trust score, fraud monitor, matching finder, impact summary, payout
  concierge, complaint resolver, donor conversion, fee optimizer, viral loop.
- **Marketing**: admin marketing (campaigns, automations, segments, audience,
  copilot, outreach), organizer marketing, tracking links, unsubscribe.
- **Admin**: users, campaigns, donations, payouts, finance, content,
  trust-safety, support, countries, sponsors, settings, audit log, reports,
  system health, new-customers pipeline.
- **Trust & safety**: campaign/user reports, risk scoring (`lib/risk.ts`),
  fraud scan, trust reviews, trust signals.
- **Platform**: notifications, integrations, exports (donations/donors/full),
  PWA (service worker, offline page, install prompt), i18n scaffold,
  multi-currency, SEO (sitemap, robots, opengraph, JSON-LD).

### Partial (needs provider config or hardening)
- **SMS** (Twilio env unset), **AI image/video generation**, **semantic
  search** (keyword only today), **grant/sponsor/volunteer marketplaces**
  (sponsor records + matching exist; full marketplaces do not),
  **corporate giving / matching gifts** (employer-matching lib exists).

### Missing (genuinely not implemented)
- NFC tap-to-donate, crypto donations, stock/DAF/estate giving, native
  livestream donations, native mobile apps, volunteer shift/hours system,
  event ticketing/check-in, white-label custom domains.

---

## 0.1 Session Log — Verified Fixes (with evidence)

Format: `ID · area · what · evidence (commit)`. Only fixes verified by
tests/build/live-HTTP are listed here.

- **CHAR-F001 · trust/data** — Removed auto-seeding of 50 fabricated corporate
  sponsors and 500 fabricated support tickets into the live DB on admin page
  visit (fake social proof on public homepage). Empty states + public sponsor
  bar hide-when-empty already handled. _Evidence: typecheck/lint/339 tests
  pass; commit `c35b1f6`._
- **CHAR-F002 · admin/ui** — Wired the dead "Feature Campaign" and "Pin to
  Homepage" action buttons (`onClick={() => {}}`) to real featured/pinned
  toggles. _Evidence: commit `c35b1f6`._
- **CHAR-F003 · marketing/data** — about-us hero + impact stats now always
  render real Supabase-backed values instead of inventing `350+`/`$2M+`/
  `5,000+` when real counts are zero; ai-growth-plan drops the fabricated
  "platform median of $42" claim. _Evidence: commit `e002118`._
- **CHAR-F004 · security** — Fixed framing headers: campaign embed route is
  now frame-able by third parties (`CSP: frame-ancestors *`) while all other
  routes stay clickjacking-protected (`frame-ancestors 'self'` + X-Frame-
  Options SAMEORIGIN); removed the conflicting global `X-Frame-Options: DENY`.
  _Evidence: verified via live HTTP header inspection on dev server; commit
  `a68ddf0`._

- **CHAR-F005 · payments/correctness** — Fixed a check-then-act race in the
  `record_donation` RPC that could double-count donations (and inflate campaign
  `raised_amount`/`backer_count`) when Stripe delivers the same
  `checkout.session.completed` webhook concurrently. Added a transaction-level
  advisory lock keyed on the payment intent / session id so duplicate
  deliveries serialize and the second sees the existing row. Mirrored into
  `schema.sql`. _Evidence: migration `20260719120000`; 339 tests still pass.
  Needs to be applied to the DB via the normal migration flow._

- **CHAR-F006 · security/tests** — Verified (spec §7) that **all 114 tables**
  have RLS enabled — 80 via literal statements, 34 (payment + marketing
  clusters) via dynamic `foreach ... enable row level security` loops that a
  static grep can't see. Marketing tables use an intentional deny-by-default
  design (RLS on, no anon/authenticated policies, service-role only). Added
  `__tests__/rls-coverage.test.ts`, a DB-free regression guard that parses the
  real migration + schema SQL and fails if any future table lacks RLS. Replaces
  reliance on the older `rls.test.ts` which only tests a TS re-implementation of
  the policy logic, not the real schema. _Evidence: 341 tests pass (was 339)._
- **CHAR-F007 · security/production** — The rate limiter was a process-local
  in-memory Map, so on serverless (Vercel) each instance kept its own counter
  and the effective limit was `limit × instanceCount` — silently defeating
  throttling on every public endpoint (AI generation, lead capture, reports).
  It also never evicted expired keys (memory leak). Fixed: (1) in-memory
  limiter now sweeps expired entries; (2) added a durable Postgres-backed
  limiter (`check_rate_limit` RPC + `rate_limit_hits` table, migration
  `20260719130000`) enforcing one shared counter across instances, degrading to
  the in-memory limiter if the DB is unavailable; (3) wired the expensive
  `ai/campaign` endpoint to the durable limiter. Also aliased `server-only` in
  vitest so server modules are testable. _Evidence: 348 tests pass (+7 incl.
  eviction + durable-fallback); build ✅._
- **CHAR-F008 · privacy** — The public donor-wall endpoint
  (`GET /api/campaigns/[id]/donations`) returned supporter names, messages, and
  amounts for **any** campaign id, including `private` (owner-only) campaigns.
  Added a visibility guard so private/deleted campaigns return an empty wall;
  public + unlisted are unchanged. _Evidence: 348 tests pass; typecheck/lint ✅._
- **CHAR-F009 · security/authz** — `POST /api/upload/campaign-image` accepted a
  `campaignId` and wrote media under that campaign's storage folder **without
  verifying the caller could manage the campaign** — any authenticated user
  could upload into another user's campaign media (the DELETE handler already
  checked ownership; POST didn't). Added a `canManageCampaign` check. The
  receipt + profile-image upload endpoints were audited and already enforce
  ownership/user-scoping. _Evidence: 348 tests pass; typecheck/lint ✅._
- **CHAR-F010 · security/exports** — All 5 CSV export endpoints (donors,
  donations, analytics, admin reports, admin payments) wrote user-controlled
  values (donor names, messages, tags, campaign titles) into CSVs with only
  structural escaping — a value like `=HYPERLINK(...)` or `+cmd|calc` executes
  as a formula when the organizer/admin opens the file (CSV/formula injection).
  Centralized a `lib/csv.ts` helper that neutralizes leading formula triggers
  (`= + - @`, tab, CR) while preserving genuine numbers, and refactored all 5
  routes onto it. _Evidence: 356 tests pass (+8, incl. injection cases);
  build ✅._
- **CHAR-F011 · security/XSS (high)** — Stored XSS via JSON-LD. Campaign pages
  serialized `campaign.title` and user-authored FAQ text into
  `<script type="application/ld+json">` with `JSON.stringify`, which does not
  escape `<`/`>`/`&`. A campaign titled `</script><script>…</script>` would
  execute on every visitor viewing that public page (session/cookie theft).
  Added `lib/json-ld.ts#safeJsonLd` (escapes `< > &` + U+2028/U+2029 to unicode)
  and applied it to all 9 JSON-LD script tags across 7 pages (campaign, home,
  blog, features, help, faq, pricing). _Evidence: 360 tests pass (+4, incl. a
  `</script>` breakout case); build ✅._
- **CHAR-F012 · payments/connect** — The Stripe webhook verified signatures
  only against `STRIPE_WEBHOOK_SECRET`, but it also handles Connect events
  (`account.updated`, `payout.created/paid/failed`, `transfer.created`) that in
  a standard setup arrive on a separate endpoint signed with
  `STRIPE_CONNECT_WEBHOOK_SECRET`. Those would be rejected (400), silently
  breaking payout status + onboarding-completion (`stripe_onboarded`). Now
  verifies against both configured secrets. _Evidence: typecheck/lint/360
  tests pass._
- **CHAR-F013 · scalability** — `POST /api/team-members` (invite co-organizer)
  loaded up to 1000 auth users into memory per invite and silently failed to
  find anyone beyond the first page. Replaced with an indexed, wildcard-escaped
  case-insensitive `profiles` lookup by email. Authorization on team-members
  POST/PATCH/DELETE was audited and correctly enforces campaign ownership
  (or self-removal). _Evidence: typecheck/lint/360 tests pass._
- **CHAR-A001 · audit (no fix needed)** — Verified sound: open-redirect
  protection (`safeNextPath` rejects non-local hosts, `javascript:`, `//host`),
  recurring-donation cancel/pause ownership, campaign sub-resource mutation
  authz (milestones/updates/rewards/faqs/settings/beneficiaries), receipt +
  profile-image upload scoping. No changes required.
- **CHAR-O001 · data** — 50 fabricated sponsors + 500 fabricated support cases
  already exist in the **live** Supabase (inserted before CHAR-F001). Deleting
  production rows needs explicit owner approval — not yet actioned.
- **CHAR-O002 · security** — Live Stripe/Supabase/Resend/Google/CRON secrets
  were exposed in chat and should be **rotated**.
- **CHAR-O003 · content** — about-us company-history timeline (2022–2026,
  "millions raised") is fabricated brand narrative; owner should confirm/revise.
- **CHAR-O004 · security** — No full Content-Security-Policy (script-src/
  style-src) yet; only `frame-ancestors`. Full CSP needs a nonce strategy
  because the app uses pervasive inline styles.

---

## 0.2 Highest-Value Backlog (prioritized, next up)

1. ~~Stripe webhook idempotency + signature hardening~~ — **DONE** (CHAR-F005
   idempotency advisory-lock + CHAR-F012 dual-secret verification).
2. **RLS test matrix** — automated tests per persona (donor, organizer,
   nonprofit admin, support, finance, super admin) proving tenant isolation
   against a live Postgres (needs a test DB; the DB-free coverage guard from
   CHAR-F006 is shipped).
3. **Full CSP with nonces** — enforce script-src/style-src safely (CHAR-O004).
4. **Semantic search** — upgrade keyword search to embeddings-backed search.
5. **Production seed strategy** — replace/guard the seeded campaigns/donations/
   profiles so real vs. demo data is unambiguous (CHAR-O001).

See **§0.3** below for the detailed, per-task breakdown of the largest
remaining feature gaps.

---

## 0.3 Structured Task Backlog (implementable)

Detailed task breakdown for the highest-value gaps, in the spec's §4 format.
Status values: Not Started · In Progress · Blocked · Code Complete · Testing ·
Verified · Production Ready. These are grounded in the current codebase
(existing tables/routes noted under Dependencies).

### Nonprofit onboarding & verification

- [ ] **CHAR-1001**
  - Area: Nonprofits
  - Feature: Nonprofit registration & profile
  - Description: Let an org register as a nonprofit (legal name, EIN/registration
    number, country, address, mission, website, logo) and manage a public
    charity profile page. Builds on the existing `nonprofit_profiles` table and
    `admin/nonprofits` route rather than a new schema.
  - Agent: 5 (Nonprofits)
  - Priority: High
  - Dependencies: `nonprofit_profiles` table (exists); `profiles.role`; Storage
    `campaign-media`/a new `org-logos` bucket.
  - Database: extend `nonprofit_profiles` (ein, country, address, status);
    migration + RLS (owner read/write, public read of verified only).
  - API: `POST/PATCH /api/nonprofits`, `GET /api/nonprofits/[slug]`.
  - UI: `/dashboard/nonprofit` onboarding wizard; public `/nonprofits/[slug]`.
  - Security: server-side validation (EIN format), owner-scoped RLS, admin-only
    verification transitions.
  - Tests: zod schema unit tests; RLS coverage (already guarded); route authz.
  - Completion Evidence: —
  - Commit: —

- [ ] **CHAR-1002**
  - Area: Nonprofits / Trust
  - Feature: Nonprofit verification workflow
  - Description: Document upload (501(c)(3) letter, registration proof), admin
    review queue, status transitions (pending → in_review → verified/rejected),
    verified trust badge on charity + campaign pages.
  - Agent: 7 (Trust & Safety)
  - Priority: High
  - Dependencies: CHAR-1001; `nonprofit_verifications`; `receipts`-style private
    Storage bucket with signed URLs (pattern exists in `upload/receipt`).
  - Database: `nonprofit_verifications` (status, documents[], reviewer_id,
    notes, decided_at); audit_logs entries.
  - API: `POST /api/nonprofits/[id]/verification`, admin
    `PATCH /api/admin/nonprofits/[id]/verification`.
  - UI: org verification page; admin review UI under `admin/trust-safety`.
  - Security: private bucket + signed URLs; admin-only decisions; audit log.
  - Tests: status-machine unit tests; upload authz (mirror CHAR-F009 pattern).
  - Completion Evidence: —
  - Commit: —

### Volunteer system

- [ ] **CHAR-1101**
  - Area: Volunteers
  - Feature: Volunteer profiles, opportunities & applications
  - Description: Volunteer profile (skills, interests, availability, location);
    orgs post opportunities; volunteers apply; org approves/declines.
  - Agent: 5
  - Priority: Medium
  - Dependencies: profiles; nonprofit_profiles (CHAR-1001).
  - Database: `volunteer_profiles`, `volunteer_opportunities`,
    `volunteer_applications` (+ RLS: public read of open opportunities,
    owner-scoped applications).
  - API: CRUD routes under `/api/volunteers/*`.
  - UI: `/volunteer` marketplace, opportunity detail, application flow,
    org management under dashboard.
  - Security: owner-scoped RLS; rate-limit public application submissions
    (use `checkRateLimitDurable`).
  - Tests: matching logic; authz; RLS coverage guard picks up new tables.
  - Completion Evidence: —
  - Commit: —

- [ ] **CHAR-1102**
  - Area: Volunteers
  - Feature: Shifts, check-in/out & hours tracking
  - Description: Schedule shifts, QR check-in/out, accumulate verified hours,
    export hours for corporate volunteer programs.
  - Agent: 5
  - Priority: Medium
  - Dependencies: CHAR-1101.
  - Database: `volunteer_shifts`, `volunteer_hours`.
  - API: shift CRUD, check-in/out endpoints (idempotent).
  - UI: shift calendar, check-in screen, hours dashboard.
  - Security: signed check-in tokens; org-scoped RLS.
  - Tests: hours aggregation; idempotent check-in.
  - Completion Evidence: —
  - Commit: —

### Events & ticketing

- [ ] **CHAR-1201**
  - Area: Events
  - Feature: Fundraising events with registration & ticketing
  - Description: Create free/ticketed events tied to a campaign; registration;
    Stripe-backed paid tickets reusing the existing checkout + webhook flow;
    QR check-in.
  - Agent: 2 / 3
  - Priority: Medium
  - Dependencies: campaigns; Stripe checkout + webhook (reuse `record_donation`
    idempotency pattern for ticket purchases).
  - Database: `events`, `event_registrations`, `event_tickets`,
    `event_checkins`.
  - API: event CRUD, register, ticket purchase (Checkout Session), check-in.
  - UI: event page, registration, ticket wallet, organizer check-in scanner.
  - Security: capacity limits enforced server-side; idempotent ticket issuance;
    signed check-in QR tokens.
  - Tests: capacity/waitlist logic; idempotent purchase; refund path.
  - Completion Evidence: —
  - Commit: —

### Corporate giving & matching gifts

- [ ] **CHAR-1301**
  - Area: Corporate giving
  - Feature: Employer matching gifts
  - Description: Donor selects employer at checkout; matching rules
    (ratio, cap) create a pending match; corporate admin approves; matched funds
    recorded against the campaign. Builds on existing `lib/employer-matching.ts`.
  - Agent: 5 / 3
  - Priority: Medium
  - Dependencies: donations; `corporate_accounts`; employer-matching lib.
  - Database: `corporate_accounts`, `matching_rules`, `matching_gifts`.
  - API: employer lookup (exists), match creation on donation, admin approval.
  - UI: employer picker at checkout (widget exists), corporate admin dashboard.
  - Security: corporate-admin RLS; budget caps enforced server-side; audit log.
  - Tests: match calculation (ratio/cap); approval workflow; idempotency.
  - Completion Evidence: —
  - Commit: —

### Platform hardening (from open items)

- [ ] **CHAR-1401**
  - Area: Security
  - Feature: Full Content-Security-Policy with nonces (CHAR-O004)
  - Description: Add script-src/style-src CSP using a per-request nonce injected
    via middleware; the app's pervasive inline styles need `style-src` handling
    (nonce or hash). `frame-ancestors` already shipped (CHAR-F004).
  - Agent: 8 / 9
  - Priority: High
  - Dependencies: middleware.ts; root layout.
  - Security: eliminates inline-script/style injection surface.
  - Tests: middleware header test; live-HTTP verification per CHAR-F004.
  - Completion Evidence: —
  - Commit: —

- [ ] **CHAR-1402**
  - Area: Data integrity (CHAR-O001)
  - Feature: Production seed guard + demo-data labeling
  - Description: Ensure seeded campaigns/donations/profiles are unambiguously
    demo (flag column or separate env), and provide an admin-approved cleanup
    path for the fabricated sponsors/support rows already in the live DB.
  - Agent: 1 / 9
  - Priority: High
  - Dependencies: schema.sql seed block; admin approval (owner decision).
  - Security: never auto-delete production rows without explicit confirmation.
  - Tests: seed idempotency; guard prevents seed in production env.
  - Completion Evidence: —
  - Commit: —

---

## 1. Core Vision Pillars

The ten pillars that define the platform.

- [ ] **AI Campaign Builder** — Generate compelling campaigns from a few sentences.
- [ ] **AI Campaign Manager** — Continuously optimize headlines, stories, images, goals, and outreach.
- [ ] **AI Donor Matching** — Recommend likely donors, grants, foundations, sponsors, and volunteers.
- [ ] **Impact Intelligence** — Show donors exactly how every dollar was used through dashboards, photos, videos, milestones, and verified updates.
- [ ] **Transparency Score** — AI-generated trust and accountability ratings for every campaign.
- [ ] **Marketing Automation** — Publish optimized content to websites, email, SMS, YouTube, Facebook, Instagram, LinkedIn, X, TikTok, and more from one workflow.
- [ ] **Enterprise CRM** — A full relationship platform for donors, sponsors, volunteers, grant makers, and nonprofits.
- [ ] **Marketplace** — Connect charities with volunteers, professional services, donated goods, equipment, and corporate sponsors.
- [ ] **Predictive Fundraising** — AI forecasts fundraising performance and recommends improvements before launch.
- [ ] **Autonomous Fundraising Agent** — An AI assistant that drafts updates, suggests outreach, identifies grant opportunities, and recommends the next best action while keeping humans in control.

---

## 2. Feature Comparison & Build Checklist

Legend for **GoFundMe** column: current state on GoFundMe today.
Each row's world-class opportunity is what CharitMe aims to deliver.

### Campaign Types

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [x] | Personal Fundraisers | ✅ | No | Equal |
| [ ] | Nonprofit Campaigns | ✅ | Slight | Native nonprofit onboarding with AI |
| [ ] | Medical Fundraising | ✅ | No | Add AI medical assistant & verification |
| [ ] | Memorial Campaigns | ✅ | No | AI memory pages, annual remembrance |
| [ ] | Disaster Relief | ✅ | No | AI emergency campaign generator |
| [ ] | Animal Rescue | ✅ | No | Rescue network integrations |
| [ ] | Schools/Classrooms | Limited | No | AI teacher fundraising templates |
| [ ] | Churches | Limited | No | Church management integrations |
| [ ] | Sports Teams | Limited | No | Team portals & registrations |
| [ ] | Community Projects | ✅ | No | Civic collaboration hub |

### Engagement & Content

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Campaign Updates | ✅ | No | AI-generated updates automatically |
| [ ] | Comments | ✅ | No | AI moderation & summaries |
| [ ] | Photo Uploads | ✅ | No | Unlimited optimized media |
| [ ] | Video Uploads | Basic | Yes | AI-generated campaign videos |

### AI Creation Suite

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | AI Campaign Writer | ❌ | Yes | One-click campaign generation |
| [ ] | AI Rewrite | ❌ | Yes | Multiple emotional tones |
| [ ] | AI Goal Recommendation | ❌ | Yes | Predict optimal fundraising target |
| [ ] | AI Success Prediction | ❌ | Yes | ML scoring before publishing |
| [ ] | AI Campaign Coaching | ❌ | Yes | Live fundraising coach |
| [ ] | AI Donor Suggestions | ❌ | Yes | Predict highest-likelihood donors |
| [ ] | AI Social Media Generation | ❌ | Yes | One-click social campaigns |
| [ ] | AI Email Campaigns | ❌ | Yes | Personalized donor outreach |
| [ ] | AI SMS Campaigns | ❌ | Yes | Automated reminders |
| [ ] | AI Thank You Messages | ❌ | Yes | Personalized by donor history |
| [ ] | AI Video Creation | ❌ | Yes | Auto-create TikTok, Shorts, Reels |
| [ ] | AI Image Generation | ❌ | Yes | Free campaign graphics |
| [ ] | AI Grant Matching | ❌ | Yes | Recommend grants automatically |
| [ ] | AI Corporate Sponsor Matching | ❌ | Yes | Find sponsors |
| [ ] | AI Volunteer Matching | ❌ | Yes | Recruit volunteers |
| [ ] | AI Event Planning | ❌ | Yes | Generate fundraising events |

### Payments & Donations

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Stripe Connect | Partial | No | Better payout flexibility |
| [ ] | Multiple Payment Methods | ✅ | Equal | Apple Pay, Google Pay, Venmo, ACH |
| [ ] | Recurring Donations | ✅ | Slight | Flexible recurring schedules |
| [ ] | International Support | ✅ | Yes | Multi-language AI |
| [ ] | QR Code Donations | Partial | Slight | Dynamic QR campaigns |
| [ ] | NFC Donations | ❌ | Yes | Tap-to-donate |
| [ ] | Crypto Donations | Limited | Yes | Multi-chain support |
| [ ] | Stock Donations | Limited | Yes | Integrated brokerage |
| [ ] | DAF Donations | Emerging | Slight | Native donor-advised funds |
| [ ] | Estate Giving | Limited | Yes | AI legacy planning |
| [ ] | Livestream Donations | Limited | Yes | Native streaming |

### Trust, Safety & Verification

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Fraud Detection | Excellent | Yes | AI fraud engine + risk scoring |
| [ ] | Identity Verification | Good | Slight | Biometric verification |
| [ ] | Donor Protection | Excellent | Yes | Strong guarantees |
| [ ] | Campaign Verification | Good | Slight | AI document verification |
| [ ] | Trust & Safety Team | Large | Yes | AI-assisted moderation |
| [ ] | Charity Ratings | ❌ | Yes | AI transparency score |

### Discovery & Experience

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Mobile Experience | Excellent | Equal | Native AI assistant |
| [ ] | Native Apps | ✅ | Equal | AI-first experience |
| [ ] | Search | Good | Slight | Semantic AI search |
| [ ] | Categories | Good | Equal | AI categorization |
| [ ] | Discovery Feed | Limited | Yes | TikTok-style giving feed |
| [ ] | Trending Causes | ✅ | Equal | AI recommendations |
| [ ] | Live Donation Feed | Limited | Slight | Interactive donor wall |
| [ ] | Donor Communities | ❌ | Yes | Community engagement |
| [ ] | Gamification | ❌ | Yes | Missions, achievements |
| [ ] | Leaderboards | ❌ | Yes | Friendly competition |

### Dashboards & CRM

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Donor Dashboard | Basic | Yes | Wealth dashboard |
| [ ] | Creator Dashboard | Good | Slight | Full business analytics |
| [ ] | CRM | Limited | Yes | Full donor CRM |
| [ ] | Impact Tracking | Limited | Yes | Real-time impact dashboard |

### Marketing & Growth

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Marketing Automation | Limited | Yes | Enterprise marketing platform |
| [ ] | Email Marketing | Limited | Yes | AI optimization |
| [ ] | SMS Marketing | Limited | Yes | Journey automation |
| [ ] | Social Publishing | Limited | Yes | Publish everywhere in one click |
| [ ] | A/B Testing | Limited | Yes | AI optimization engine |
| [ ] | SEO Tools | Limited | Yes | Automated SEO/AEO |
| [ ] | Analytics | Good | Slight | Predictive analytics |

### Platform, Enterprise & Compliance

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Tax Receipts | ✅ | Equal | Auto-generated |
| [ ] | Admin Portal | Good | Slight | Enterprise Super Admin |
| [ ] | API | Limited | Yes | Open developer ecosystem |
| [ ] | Webhooks | Limited | Yes | Event-driven automation |
| [ ] | Enterprise Controls | Limited | Yes | RBAC, audit logs |
| [ ] | White Label | Limited | Yes | Full branding |
| [ ] | Accessibility | Good | Equal | WCAG AAA target |
| [ ] | Multi-language | Good | Equal | AI translation |
| [ ] | Offline Mode | ❌ | Yes | Offline event fundraising |

### Marketplace & Corporate Giving

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Marketplace | ❌ | Huge | Charity services marketplace |
| [ ] | Volunteer Marketplace | ❌ | Yes | Skills exchange |
| [ ] | Corporate Giving | Partial | Slight | Employee giving platform |
| [ ] | Matching Gifts | Partial | Slight | Automatic employer matching |

---

## 3. Where GoFundMe Is Still Stronger Today

Competitive gaps to close. These are strategic priorities, not features.

| Area | Why |
|------|-----|
| Brand Recognition | Global household name |
| Massive Trust | Millions of successful campaigns |
| Fraud Prevention | Mature Trust & Safety organization |
| Network Effects | Large donor base drives discovery |
| Global Payment Infrastructure | Established across many countries |
| Regulatory Compliance | Mature legal and compliance processes |
| Organic SEO | Dominates fundraising-related search results |
| Campaign Virality | Large built-in audience |
| Operational Scale | Years of optimization and experience |

---

# Section C — Pricing & Revenue Model Audit (2026-07-20)

Backlog from the Pricing & Revenue Model audit. See `docs/competitor-pricing-analysis.md`
and `docs/pricing-audit-log.md`. Priority: P0 (done this pass) → P2. Items touching
Stripe billing / live data are `needs-staging` per ADR-0003.

| # | Pri | Sev | Task | Affected files / areas | Resolution | Deps | Est | Status |
|---|-----|-----|------|------------------------|------------|------|-----|--------|
| C1 | P0 | — | Canonical `donationBreakdown()` + support ladder + "recipient receives" line | `packages/shared/fees.ts`, `DonateButton.tsx`, `fees.test.ts` | Shipped; 556 tests green | — | 0.5d | **Code Complete** |
| C2 | P1 | med | Standalone **"Where your money goes"** animated explainer (reuses `donationBreakdown`) | new `app/where-your-money-goes/` + shared `MoneyBreakdown` component | Build pure component, drive from breakdown | C1 | 1d | Not Started |
| C3 | P1 | med | **Transparency Center** page (fees, Stripe, KYC/AML, refunds, escrow=none, FAQ, dark/light) | new `app/transparency/`, link from footer | Static + JSON-LD FAQ | C2 | 1.5d | Not Started |
| C4 | P1 | high | **CharitMe Plus** organizer subscription ($19.99/mo) wired to Stripe Billing + entitlements | new `subscriptions`/`entitlements` tables, `/api/billing/*`, feature flags | Stripe test keys + staging | Stripe test env | 3d | Blocked (`needs-staging`) |
| C5 | P2 | high | Nonprofit tiers (Starter/Growth/Professional/Enterprise) + comparison table + upgrade flow | plans model, `app/pricing/`, billing portal | Follows C4 | C4 | 3d | Blocked (`needs-staging`) |
| C6 | P1 | med | Checkout: Apple/Google Pay, ACH, saved methods, round-up (Stripe Payment Element) | `DonateButton.tsx` → Payment Element, `/api/donations` | Stripe test env | Stripe test env | 2d | Blocked (`needs-staging`) |
| C7 | P2 | med | Admin **pricing dashboard**: MRR/ARR/LTV/CAC, avg donation, **support-reduction %**, funnel | `app/admin/pricing/`, subscription analytics | Needs subs data (C4) | C4 | 2d | Not Started |
| C8 | P2 | low | Dedicated `/pricing` marketing page + SEO/AEO (schema, FAQ JSON-LD, OG) targeting "fundraising fees" | `app/pricing/`, metadata | — | C1 | 1d | Not Started |
| C9 | P2 | low | Legal: Fee Policy, Refund Policy, Subscription Terms, Transparency Policy — cross-linked | `app/legal/*` | Copy review | — | 1d | Not Started |

**Guardrails (apply to all C-items):** support always optional/reducible to 0% (no
dark patterns); recipient net never reduced by the 0% platform fee; subscriptions are
additive revenue and must never gate free giving or free fundraising.
