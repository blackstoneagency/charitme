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

## 4. Delivered on `claude/charitme-github-integration-tbaz3i` (PR #10)

Five additional feature domains shipped as complete vertical slices (migration +
RLS + pure unit-tested logic + typed API + UI), complementing the grants/volunteers
work already on master. All `[~] Code Complete` — verified by typecheck + unit tests
+ lint + production build, **not** yet exercised against live Supabase (needs-staging).
See `docs/gap-audit.md` for the full audit.

| Domain | Tables | API | UI | Tests |
|--------|--------|-----|----|-------|
| **Matching gifts** (corporate) | `matching_gift_claims` | `/api/matching-gifts` (+`/[id]`) | `/dashboard/matching-gifts` | 16 |
| **Sponsorship marketplace** | `sponsorship_opportunities`, `sponsorship_requests` | 3× `/api/sponsorships/*` | `/sponsor`, `/dashboard/sponsorships` | 9 |
| **Gamification** (durable badges + challenges) | `user_badges`, `challenges`, `challenge_participants` | `/api/badges`, 2× `/api/challenges/*` | `/dashboard/challenges` | 7 |
| **Privacy** (export/deletion requests) | `privacy_requests`, `consent_records` | `/api/privacy/requests` (+`/[id]`) | `/dashboard/privacy` | 7 |
| **Events** (public pages + registration) | existing `fundraising_events`/`event_*` | 3× `/api/events/*` | `/events`, `/events/[slug]`, `/dashboard/events` | 7 |

Each domain enforces server-side authz + validated state-machine transitions, and
ships a pure logic module with no Supabase/Next imports. Remaining scope per domain
(admin queues, paid-ticket checkout, corporate-account tenancy) tracked inline above.

### Follow-up: Corporate-account tenancy (delivered) — completes the matching-gifts domain

> Note: this branch's feature IDs are independent of Agent 0's `CHAR-00xx` grants/volunteers numbering above.

Adds corporate accounts, employees, and matching-gift rules on top of this branch's matching-gifts slice.

| Piece | Detail |
|-------|--------|
| Tables | `corporate_accounts`, `corporate_members`, `matching_gift_rules` (+ `matching_gift_claims.corporate_account_id`), migration `20260721000000`, all with RLS (admin manages; members read) |
| Logic | `lib/corporate.ts` — pure rule selection (category-specific > catch-all), match computation with per-gift + annual caps, email-domain matching (14 unit tests) |
| API | `GET/POST /api/corporate`, `GET/POST /api/corporate/rules` (+ `PATCH/DELETE /[id]`), `GET/POST /api/corporate/members` — corporate-admin-scoped |
| UI | `/dashboard/corporate` — register company, define rules with caps, invite employees + nav entry |
| Evidence | typecheck ✅ · 423 unit tests ✅ (14 new) · lint ✅ · build ✅. Not yet verified against live Supabase. |

### Follow-up: corporate rules wired into the matching-gift claim flow (delivered)

`POST /api/matching-gifts` now resolves the match against a registered corporate
account's rules + caps (via `lib/corporate.resolveCorporateMatch`) when the donor
has an active membership or an email domain matching a company — linking
`corporate_account_id` and using the real ratio/caps net of the donor's prior
matches this year. Falls back to the static estimator otherwise. The response
carries `estimate.source: 'corporate' | 'estimator'`. Verified: typecheck · 423
unit tests · lint · build all pass (corporate resolution logic covered by the
14 `lib/corporate` tests).

### Follow-up: admin challenge authoring (delivered)

Makes the gamification challenges feature usable end-to-end — previously challenges
could only be created via raw SQL. Admins can now create, publish, end, and reopen
giving challenges from `/admin/challenges`.

| Piece | Detail |
|-------|--------|
| Logic | `lib/challenges.ts` extended with `slugifyChallenge`, `challengeWindowValid`, `isChallengeGoalType` (pure, +3 unit tests) |
| API | `GET/POST /api/admin/challenges`, `PATCH /api/admin/challenges/[id]` — admin-gated; window validation |
| UI | `/admin/challenges` — create draft, publish/end/reopen, participant counts + admin nav entry |
| Evidence | typecheck ✅ · 426 unit tests ✅ · lint ✅ · build ✅. Not yet verified against live Supabase. |
