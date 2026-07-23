# CharitMe — Execution Tracker

> **Agent 0 owns this file.** It is the living source of truth for the
> production-readiness program. Section A is the actionable engineering backlog.
> Section B (further down) is the competitive product vision it serves.

## 🎯 PRODUCTION-READINESS GOAL — live status (updated this session)

| Goal item | Status | Evidence / blocker |
|-----------|--------|--------------------|
| Images unique, 0 duplicates | ✅ done | covers 50→**500 distinct**, 0 dup groups (migration applied live) |
| ≥100 seed records/feature | ✅ done | 73 non-empty tables, every feature ≥100 |
| Security (RLS) | ✅ verified | **143/143** public tables RLS-on; **fixed live Stripe webhook + disabled rogue endpoint** |
| Payment webhooks | ✅ fixed | prod webhook 2→**20 events**; recurring/subs/refunds now delivered |
| Everything wired to Supabase | 🟢 mostly | core flows + new analytics table verified live |
| Tests pass / Build succeeds | ✅ | **901/901**, `next build` green, typecheck clean, lint 0 errors (2026-07-23) |
| Tax reporting (donors + campaigns) | ✅ done | **donor annual giving statements** (JSON/CSV/printable, deductibility + EIN, IRS disclosure), **fundraiser year-end summaries**, and **automatic official tax receipts** for verified-nonprofit gifts — all Supabase-wired, 12 unit tests (`lib/tax.ts`). PR #50 (merged) + PR #51 |
| Accessibility | ✅ strong | **prod Lighthouse — 7 key pages all 100**: home, how-it-works, campaigns, faq, for-donors, for-nonprofits, pricing. SEO 100, BP 96. **axe-core WCAG 2.0/2.1 A/AA → 0 violations across 15 public routes** after fixing /features dark-card contrast (new `--violet-ink` token), /for-individuals emerald buttons, /about-us timeline-year, and a role-less aria-label on `/` (PR #49) |
| Dark/light mode every page | ✅ done (app) | **#43/#46/#47**: every dashboard view + campaign panel + simple public pages converted hardcoded light palettes → design tokens; **regression guard** (`__tests__/theme-tokens.test.ts`) blocks reintroduction. Branded marketing pages keep intentional brand palettes |
| Frictionless UX | 🟢 improving | draft autosave/recovery + funnel analytics shipped; builder roadmap continues |
| Mobile | 🟢 | mobile Lighthouse on public pages good; **browser audit (320/390px × 19 public routes) → 0 horizontal overflow** after fixing pricing fee-calc grid stacking, public hero word-wrap, `.mktg-page` overflow-x clip, and home cover `max-width` (PR #49); ongoing |
| Performance | 🟢 improving | prod home **63→88** (LCP 4.1→3.1s, TBT 640→100ms) by fixing the 292KB→6.7KB oversized logo served sitewide. Remaining: unused CSS/JS (lower value) |
| Payment methods end-to-end | 🟡 owner/test-keys | live account charges-enabled, 15+ methods active, price ids resolved; a real paid flow needs Stripe **test** keys or owner go-ahead (ADR-0003) |
| Every page audited / every feature works | 🟡 ongoing | unbounded; audited builder + discovery + payments deeply |

**Owner actions still blocking full production-readiness** (step-by-step in
**`docs/DEPLOY_STRIPE.md`**): (1) set Stripe env in **Vercel** (`STRIPE_SECRET_KEY`,
publishable, `STRIPE_WEBHOOK_SECRET`, 4 price ids, tip%) — **✅ DONE & verified
live** via `/api/health` (stripeKey live, publishable/webhook secret set, supabase
connected); (2) ✅ **eli54u.com webhook DELETED** (Stripe API, `deleted:true`; only
the legit charitme endpoint w/ 20 events remains); (3) provide **OpenAI** +
**Unsplash** keys; (4) decide **publish-before-payout** (biggest builder drop-off lever).
**Resolved:** `STRIPE_CONNECT_WEBHOOK_SECRET` is **NOT needed** — verified in the
webhook handler (tries `STRIPE_WEBHOOK_SECRET` first, filters unset secrets); the
single endpoint receives all Connect events signed with the main secret. Leave unset.

> **Payment Workflow Hardening pass (2026-07-21)** — see **Section D** at the end
> of this file and the companion **`payment-audit.md`** for the exhaustive
> per-workflow audit + fixes.

## Status legend
`Not Started` · `In Progress` · `Blocked` · `Code Complete` · `Testing` · `Verified` · `Production Ready`

A task reaches **Verified** only with real evidence (test name, route, Supabase
record, screenshot, commit). Per **ADR-0003**, tasks touching live data / Stripe /
payouts / RLS cannot exceed `Code Complete` from the current sandbox — they are
tagged `needs-staging` until a staging Supabase + Stripe test project is available.

## Audit baseline (2026-07-19; refreshed 2026-07-21)
Platform is **already mature and healthy**: ~130 pages, 200+ API routes, 132 live
tables (post-reconciliation), **746 passing tests**, type-clean build, green CI. This
is a **gap-closure + hardening + elevation** program, not a rebuild (ADR-0001).

## Gap analysis — STATUS REFRESH (2026-07-21)
> ⚠️ The original 2026-07-19 gap table below listed these domains as Absent/Thin.
> Every one has since been **built and reconciled into the live DB (132 tables)**,
> and most were **verified end-to-end this session**. Do NOT rebuild them — verify
> and polish only.

## Launch-Readiness Seed Audit (2026-07-21)

Goal: **every feature/service offering seeded with ≥100 rows** so the live site
demonstrates real volume in every list, dashboard, and admin console. The seed
suite lives in `supabase/seeds/` (run `00`→`06`, then `99` to verify). Each file
loads **120 rows/table**, guarded by `to_regclass()` + `on conflict do nothing`,
so it is safe on any database and re-runnable.

| Seed file | Feature domain | Tables | Rows/ea |
|-----------|----------------|--------|---------|
| `00_test_users.sql` | Accounts | `auth.users`→`profiles` | 120 |
| `01_campaigns_core.sql` | Campaigns + donations | campaigns, updates, faqs, milestones, rewards, donations, saved, notifications | 120 |
| `02_marketplaces.sql` | Grants · sponsorships · matching · volunteers · nonprofits | 12 tables | 120 |
| `03_events.sql` | Events & peer fundraising | events, tickets, registrations, check-ins, peer_fundraisers | 120 |
| `04_impact_gamification.sql` | Impact & gamification | impact_*, challenges, participants, badges | 120 |
| `05_engagement_financial.sql` | Engagement & financial history | donor_messages, recurring, refunds, payouts, verification, risk_flags, tax_receipts, business_leads | 120 |
| **`06_extended_features.sql`** *(new)* | **Creator monetization · digital products · auctions · livestreams · giving days · donor CRM** | creator_profiles, membership_tiers, member_subscriptions, exclusive_posts, creator_tips, digital_products, product_orders, auction_items, auction_bids, livestreams, giving_days, donor_crm_contacts, donor_segments, campaign_media, transparency_ledger_items | 120 |
| `99_verify_counts.sql` | *(read-only)* coverage report | 57 tables checked | — |

**Coverage: 57 feature tables** across the 15 domains now have a ≥100-row seed
path. `06` was validated end-to-end against a throwaway Postgres 16 instance
(schema loaded from the `competitor_parity_features` migration + `campaign_media`
/`transparency_ledger_items` DDL): all 15 tables reached ≥120 rows, the file ran
twice cleanly (conflict guards held), and `99` reported `OK` for every one.

> **`needs-staging` (ADR-0003).** These seeds cannot be executed against live or
> staging Supabase from the sandbox — that is the **owner's step**. Run `00`→`06`
> in the Supabase SQL editor (service role), then `99`, and confirm every row
> shows `OK`. Per-user tables only reach 100 once ≥100 profiles exist (`00`).
> Do **not** run the demo seeds against the production project without the
> demo-data guard/labeling (see “Production seed guard” below) — they insert
> fabricated rows.

## Gap analysis — genuinely absent/thin domains
Cross-referencing the required table inventory against tables actually referenced in code:

| Domain | State now (2026-07-21) | Evidence |
|--------|------------------------|----------|
| **Grants** | ✅ Built + verified | round-trip write/read/soft-delete + RLS verified live (`docs/AUDIT_PROGRESS.md`) |
| **Volunteers** | ✅ Built | CHAR-0003/0004; tables + RLS + routes live |
| **Events** | ✅ Built + verified | RSVP capacity/duplicate/RLS round-trip verified live this session |
| **Corporate giving** | ✅ Built | matching gifts (`matching_programs`/`matching_claims`, `/api/matching/*`) + **CSR dashboard** `/dashboard/corporate` (this session, on master's matching infra — the stale branch's parallel `/api/corporate/*` design was intentionally NOT ported). `corporate_accounts`/`_members` multi-admin grouping remains a P3 nicety (single `sponsor_id` owner works today) |
| **Sponsorship workflow** | ✅ Built | `sponsorship_opportunities/requests` + `/api/sponsorships/*` |
| **Formal impact tracking** | ✅ Built | `impact_plans/updates/metrics` + `/api/impact/*`; `lib/impact.ts` (currency bug fixed PAY-010) |
| **Subscriptions / recurring** | ✅ Built + verified | recurring-donation state machine + idempotency verified live; CharitMe Plus entitlements Code Complete (billing write-path Stripe-gated) |
| **Gamification (persisted)** | ✅ Built + live | `gamification-persist.ts` `syncAndGetBadges`/challenges wired to `/achievements`; **120 `user_badges` rows live** |

Well-covered already (do not rewrite): auth, campaigns, donations, payments &
payment-observability, payouts, recurring, refunds, trust/risk, marketing engine,
AI platform, admin, lead-gen — **plus all eight domains above**.

## Genuinely remaining (2026-07-21)
- **Stripe Connect live-enablement (owner)** — the one true launch blocker; unblocks
  the whole gated verification set. See `docs/PAYMENT_READINESS.md`.
- **Live-gated verification** (needs Connect + staging): end-to-end money flow,
  refund/dispute lifecycles, recurring-renewal observability, per-persona RLS matrix.
- **Far-future / out-of-scope** (from §2 comparison, not priorities): NFC tap-to-give,
  crypto, stock/DAF/estate giving, native livestream, native mobile apps, white-label.
- **Payment hardening pass: COMPLETE** — 11 defects fixed + schema-contract CI guard
  + financial-RLS verified (Section D + `payment-audit.md`).

---

# Section A — Execution Backlog

> Seeded with the highest-value real gaps + hardening. Each new domain lands as a
> vertical slice: migration (RLS-first) → typed lib → API (authz) → mobile-first UI
> → tests → docs. IDs are stable; statuses advance with evidence.

- [ ] CHAR-1403 — **Testing** — end-to-end QA of the Featured Campaign option
  - Area: Featured Campaigns / Payments
  - Feature: Paid featured-campaign placement in the homepage rotator (shipped #27)
  - Description: Manually verify the full flow now that code is merged: (1) Super Admin → Settings → Payment shows "Featured Campaign Price (USD)", editing it persists and the new price is what the creator is charged; (2) a campaign owner sees the "Feature this campaign — $X" button on their dashboard campaign page and is taken to Stripe Checkout for the configured amount; (3) on successful test-mode payment the Stripe webhook (`checkout.session.completed`, `metadata.type=feature_campaign`) flips `campaigns.featured = true`; (4) the homepage hero rotator then cycles through ONLY featured campaigns, with the countdown bar, and falls back to top campaigns when none are featured; (5) an already-featured campaign shows the "Featured" badge instead of the button and the API rejects a second purchase (400); (6) ownership gating: a non-owner POST to `/api/campaigns/:id/feature` returns 403.
  - Priority: P1
  - Dependencies: needs-staging (Stripe test-mode keys + live webhook endpoint) — cannot exceed Code Complete from sandbox per ADR-0003
  - Database: reads/writes `campaigns.featured`, reads `platform_settings.config.payment.featuredCampaignPriceCents`
  - API: `POST /api/campaigns/[id]/feature`, `GET /api/campaigns/rotator`, `stripe/webhook`
  - UI: `/dashboard/campaigns/[id]` (Feature button), `/admin/settings` (price), homepage `HeroRotator`
  - Tests: `__tests__/featured.test.ts` 8/8 pass (price resolution + rotator selection). **Pending manual/staging:** Stripe checkout → webhook → featured flip; rotator featured-only cycling; 403 ownership; 400 double-purchase.
  - Completion Evidence: (to fill in during QA — Stripe test session id, webhook event id, `campaigns.featured` DB record, homepage rotator screenshot)
  - Commit: 586fc3a (feature merged via #27)

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

- [x] CHAR-0005 — **Built + verified** (RSVP round-trip + RLS, this session)
  - Area: Events
  - Feature: Events data model + RLS
  - Description: `events`, `event_registrations`, `event_tickets`, `event_checkins` with capacity/waitlist constraints + RLS.
  - Agent: 1
  - Priority: P2
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0006 — **Built** (`fundraising_events`/`event_registrations`/`event_checkins`, `/api/events/*`)
  - Area: Events
  - Feature: Event pages, registration, ticketing, QR check-in
  - Description: Event pages, free/ticketed registration reusing Stripe checkout, attendee management, QR check-in, event-linked campaigns.
  - Agent: 2 (+3 for ticketing)
  - Priority: P2
  - Dependencies: CHAR-0005, payments infra
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0007 — **Built** (`impact_plans/updates/metrics`, `/api/impact/*`, `lib/impact.ts`)
  - Area: Impact tracking
  - Feature: Formal impact plans/updates/evidence/metrics
  - Description: `impact_plans`, `impact_updates`, `impact_evidence`, `impact_metrics` layered onto existing `transparency_ledger_items`; public impact dashboard + donor impact feed; AI impact summaries.
  - Agent: 2 (+6)
  - Priority: P1
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0008 — **CSR dashboard built + verified** (this session) — `/dashboard/corporate`
  lets a matching-program sponsor review employee claims (approve/decline/mark-paid via
  existing `PATCH /api/matching/claims/:id`) with committed/paid/pending rollups.
  Built on master's `matching_programs`/`matching_claims`/`matching-core` (the stale
  branch's conflicting `/api/corporate/*` design was deliberately not ported).
  Evidence: `summarizeProgramClaims` unit-tested (4, 750 total); `next build` compiles
  the route; live round-trip confirmed the summary math + approve write (test data
  removed, 0 residue). Nav entry added. Follow-up (P3): `corporate_accounts`/`_members`
  for multi-admin company grouping (today a single `sponsor_id` owns each program).
  - Area: Corporate giving
  - Feature: Corporate accounts + matching-gift workflow
  - Description: `corporate_accounts`, `corporate_members`, match rules/limits/approval routing; extend `lib/employer-matching.ts`; CSR dashboard.
  - Agent: 5
  - Priority: P2
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0009 — **Built** (`sponsorship_opportunities/requests`, `/api/sponsorships/*`)
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

- [x] CHAR-0011 — **Built + live** (`gamification-persist.ts` wired to `/achievements`; 120 `user_badges` rows live)
  - Area: Gamification
  - Feature: Persist badges/challenges/leaderboard state
  - Description: `badges`, `user_badges`, `challenges`, `challenge_participants`; wire `lib/gamification.ts` to DB instead of computed-only.
  - Agent: 4
  - Priority: P3
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0012 — **Audit done + RLS-contract CI guard shipped**; live per-persona anon-key certification still needs sessions
  - Area: Security / hardening
  - Feature: RLS coverage audit + automated RLS tests
  - **Guard shipped (2026-07-21):** `apps/web/__tests__/schema-rls.test.ts` pins the live RLS posture (`fixtures/schema-rls.json`) and fails CI if any public table loses RLS or any sensitive financial/PII table gains a public `USING(true)` read policy (the LB-006 class). Proven to catch injected regressions. Refresh via `npm run schema:snapshot`.
  - Audit result (refreshed 2026-07-21, live prod, 143 tables): **0 with RLS disabled**; 24 legitimately-public display tables; **0 sensitive tables publicly readable** (financial-table policies verified — see `payment-audit.md`).
  - Follow-up: full per-persona (donor/organizer/nonprofit/corporate/T&S/finance/support/admin) live certification with real anon/authenticated sessions (needs staging auth).
  - Description: Enumerate every user-accessible table, confirm RLS enabled + policies, add automated per-persona RLS tests (unauth, donor, organizer, nonprofit admin, corporate admin, T&S, finance, support, super admin).
  - Agent: 1 (+7)
  - Priority: P0
  - Dependencies: none
  - Security: core
  - Tests: RLS matrix (needs-staging for live verification)
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0013 — **Env validation + secret-exposure guard DONE**; full script-src CSP deferred (needs browser)
  - Area: Security / hardening
  - Feature: Env validation + secret-exposure audit + security headers/CSP
  - Description: Zod-validated env schema at boot; audit that no service-role/Stripe/AI secrets reach client bundles; add CSP + security headers; confirm rate-limiting coverage (`lib/rate-limit.ts`).
  - Agent: 1 (+9)
  - Priority: P0
  - Dependencies: none
  - Completion Evidence: `lib/env.ts` (zod schema, non-throwing `validateEnv`) + `npm run check:env` preflight; `__tests__/env.test.ts` (8) + `__tests__/secret-exposure.test.ts` (4) — the guard caught 4 client files pulling the Stripe server SDK for `formatCents`, fixed by moving it to `@shared/currencies`. Security headers (CSP frame-ancestors, HSTS, X-Frame-Options, Permissions-Policy, nosniff) already present in `middleware.ts`/`next.config.js`. Docs: `docs/security/env-and-secret-exposure.md`. 674 tests pass, type-clean, build 132 pages.
  - Remaining: full `script-src`/`style-src` CSP (needs a browser to verify it doesn't break the inline-style design system); automated rate-limit coverage assertions.
  - Commit: (this PR)

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
  - **Keyboard/semantics pass on public-facing components (2026-07-22):** cleared
    jsx-a11y warnings on NotificationBell (click-only <div> items → <button>),
    create GuestLoginModal (backdrop role=presentation, card role=dialog/aria-modal,
    Escape-to-close), create AiFollowUps (autoFocus → focus-follows-question via
    ref/effect), HeroRotator (decorative hover-pause → role=presentation). Verified:
    lint clean on those files, typecheck clean, `next build` compiles. **Remaining:**
    the bulk of the ~180 jsx-a11y warnings live in `/admin/*` internal tools (lower
    user impact); full axe/contrast/tap-target/320–1920px sweep still needs a browser.
  - **Dark/light theme sweep — dashboard COMPLETE (2026-07-22):** every campaign
    management panel (#43, #46: Updates/Settings/Supporters/FAQs/Ledger/ThankDonors/
    CampaignControls/EditCampaign/TrustScore/Analytics) **plus all non-campaign
    dashboard views** (payouts cards, notifications, new-update, refund, corporate,
    team, integrations, analytics, settings + mfa, ai-coach, ai-growth-plan,
    messages, home, recurring, rewards, milestones, payout-setup, plan-features,
    donor) converted from hardcoded light palettes to design tokens + theme-aware
    rgba tints. Intentional literals kept (integration brand colors, chart accents,
    gradient ends, amber/orange status, white button text). Each batch: tsc + lint
    clean, 863 tests pass. Remaining: public/marketing pages that still hardcode
    (some use Tailwind slate/emerald utilities not wired to `[data-theme]`).
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

- [~] CHAR-0017 — **Dual-path campaign builder (AI + guided) — audit done, first slice shipped, program continues**
  - Area: Campaign creation
  - Priority: P1
  - Owner goal: from an idea to a publish-ready campaign in minutes, via EITHER a
    "Build with AI" prompt path OR a step-by-step guided path, both converging on
    the same canonical campaign model, review, payout, verification, and publish.

  - **What ALREADY exists (do NOT rebuild — extend/consolidate):**
    - Guided path: `apps/web/app/create/page.tsx` — 1,696-line 9-step wizard
      (Type → Category → Location → Story → Title → Goal → Media → Get Paid → Review),
      `sessionStorage['cm_wizard']` autosave/resume, draft save (campaign
      `status='draft'`), Stripe Connect + Venmo/PayPal/GooglePay/Sinch payout step,
      publish via `POST /api/campaigns`.
    - AI path entry: `apps/web/app/ai-campaign/page.tsx` (prompt box + popular
      requests) → routes to `/create?ai=<prompt>`.
    - AI engine: `apps/web/app/api/ai/campaign/route.ts` — real OpenAI
      (`gpt-4.1-mini`) with deterministic `fallbackAiCampaign()` (`lib/openai.ts`),
      zod-validated, durable rate-limited, logged to `ai_generations`.
    - Drafts are currently just `campaigns` rows with `status='draft'` — there are
      NO dedicated `campaign_drafts` / `campaign_ai_sessions` / `campaign_creation_*`
      tables yet.

  - **DONE this session (shipped on branch `claude/charitme-github-integration-tbaz3i`, commit 9c7b142):**
    - Fixed broken Build-with-AI path: `/create` never read `?ai=<prompt>`, so the
      organizer's typed prompt was silently dropped. Now `/create` consumes `?ai=`,
      seeds the story, jumps to the Story step, and generates the first draft once
      (fallback guarantees non-empty, reviewable content). `runAi()` takes an
      optional notes override.
    - Added `__tests__/ai-campaign-fallback.test.ts` (5 tests) locking the "AI
      always returns complete content + carries the prompt into the story" contract.
    - Verified: typecheck + lint clean, build compiles, 782 tests pass.

  - **REAL gaps — sandbox-buildable, ordered by recommended sequence (pick up here):**
    1. ✅ **DONE (2026-07-21)** — Co-equal entry screen `/create/choose-path`
       presenting **Build with AI** (≈2 min) vs **Step by step** (≈10 min) as equals,
       with autosave/resume reassurance; theme-aware + mobile-first (cards stack
       < 720px). Repointed **40 generic `/create` CTAs across 24 files** (the explicit
       "…With AI" / `/ai-campaign` entries kept direct). Made the chooser a **public**
       middleware exception (viewable before sign-in, like `/ai-campaign`; the
       `/create` wizard stays login-gated). Verified: typecheck/lint clean, `next build`
       prerenders the route, live server returns **200 unauthenticated**, Playwright
       screenshot confirms the rendered design.
    2. ✅ **DONE (2026-07-21)** — AI follow-up question flow. After the AI drafts a
       campaign, the story step now asks only the human facts the AI can't infer,
       ONE at a time — who it's for, beneficiary name, relationship, category, goal,
       deadline — skipping anything the AI or profile already filled; each answer
       writes straight to the wizard form (draft updates live) so the next question
       is re-derived; skippable questions offer "I'm not sure". Pure logic
       `lib/campaign-followups.ts` (`followUpPlan`/`nextFollowUp`, 7 unit tests) +
       `app/create/AiFollowUps.tsx` (themed, mobile-first) wired into the story step.
       Verified: typecheck/lint clean, `next build` compiles, 797 tests pass.
       Follow-up (needs richer form model): use-of-funds line items, explicit
       payout-recipient/consent/anonymity fields (not in the current `FormState`).
    3. 🟡 **Partial (2026-07-22)** — Guided path: one primary question per screen.
       The 9-step wizard is already largely one-question-per-screen; the crowded
       exception was the required **Get Paid** step showing five payout methods
       flat (decision paralysis at the conversion-critical moment). Now leads with
       the one recommended option (Stripe Connect) and tucks the four alternates
       (Venmo/Google Pay/PayPal/Sinch) behind a **"More ways to get paid"**
       disclosure — alternates stay mounted (display toggle) so connected-state
       detection holds, and it auto-opens when any alternate is already linked.
       Verified: typecheck/lint clean, `next build` compiles, 776 tests pass.
       **Still to do (lower value):** collapse the location step's secondary ZIP
       behind an optional reveal; progressive disclosure for the goal step's
       auto-goal box.
    4. ✅ **DONE (2026-07-21)** — Publish-readiness engine. `lib/campaign-readiness.ts`
       (`publishReadiness`, 7 unit tests) scores title/story/goal/category/location/
       media/payout (+ beneficiary when for someone else); `required` items mirror the
       publish API EXACTLY (title/story/goal) so `readyToPublish` never disagrees with
       the server. `ReadinessChecklist.tsx` renders a live %-bar + checklist on the
       review step; each unfinished item is a **Fix →** button that jumps to its exact
       wizard step. Verified: typecheck/lint clean, `next build` compiles, 804 tests pass.
    5. ✅ **DONE (2026-07-22)** — Story quality signals done: `lib/story-analysis.ts`
       (`analyzeStory`, 5 unit tests) computes real length/structure/specificity/
       clear-ask/**unsupported-claim** signals; wired into the story step's "Strengthen
       your story" box, **replacing the previously-hardcoded fake badges** with live,
       actionable ones (tooltips explain each). AI rewrite already exists (the
       "Enhance" button → `runAi`). **✅ Structured sections + tone presets DONE
       (2026-07-22):** `lib/story-scaffold.ts` (`composeStory`/`sectionsFromText`/
       `sectionsFilled`/`TONE_PRESETS`, 7 unit tests) + `StorySectionsEditor.tsx`
       give the story step a "Guide me" mode — four sections (intro/problem/
       solution/ask) that compose into the SAME `description` field (no schema
       change, seeds from existing text so switching modes never clobbers) — plus
       tone presets (Heartfelt/Urgent/Hopeful/Straightforward) that drive an AI
       rewrite via the endpoint's existing `tone` param (`runAi` gained tone +
       forceStory overrides). Verified: typecheck/lint clean, `next build`
       compiles, unit tests pass. **Gap #5 now complete.**
    6. 🟡 **Partial (2026-07-22)** — Fee/net-proceeds breakdown done:
       `lib/goal-proceeds.ts` (`goalProceeds`, 5 unit tests) computes CharitMe's
       0% platform fee + illustrative single-transaction processing estimate,
       reusing `@shared/fees` constants so figures never drift from checkout;
       `GoalProceedsBreakdown.tsx` renders "Where your $X goes → you keep ~$N"
       on the goal step once a valid goal is entered (themed, mobile-first).
       Verified: typecheck/lint clean, `next build` compiles, unit tests pass.
       **Still to do:** line-item use-of-funds builder (needs a richer form
       model / schema — not in current `FormState`; owner/staging-gated).
    7. Admin observability: `/admin/campaign-builder{,/funnels,/ai,/verification,/errors}`.

  - **Owner/staging-gated (CANNOT be certified from sandbox — see CHAR-0016):**
    - New builder/draft/AI-session tables + RLS + triggers must be applied to LIVE
      Supabase via the Management API (no local migration path here).
    - Stripe Connect "payout ready/KYC" confirmation needs live Connect enablement
      (existing launch blocker LB-005).
    - Real AI generation needs `OPENAI_API_KEY` (sandbox runs the deterministic
      fallback only).
    - Full E2E / mobile / axe sweep needs a running authed app + staging data.

  - **Handoff notes for the next agent:**
    - Land/merge the open PR (theme polish + this AI fix) FIRST so builder work does
      not keep stacking on that branch; then branch fresh from latest master.
    - Reuse the `campaigns` model + `/api/campaigns` + `lib/openai.ts`; do NOT
      duplicate. Consolidate `/ai-campaign` and `/create` rather than forking a
      third flow.
    - Keep everything design-token themed (light/dark) and mobile-first; the create
      flow uses `cr2-*` classes in `globals.css`.
  - Commit: 9c7b142 (AI-path fix + tests)

> Backlog continues: each remaining capability in Section B becomes CHAR-#### tasks
> as its slice is scheduled. Completed tasks move to **Section C — Completed** with evidence.

---

## Campaign Image workstream

Context: campaigns are procedurally seeded with **no per-row image**; covers were
assigned per-category, so every campaign in a category shared one identical cover
(and 5 categories shared covers with each other). Full audit in
`CAMPAIGN_IMAGE_AUDIT.md`.

- [x] IMG-01 — **Done.** Distinct cover per category (was 2 collisions across 5
  categories). 3 new HTTP-200-verified covers sourced (Emergency/Travel/Wishes).
  Evidence: `audit:campaign-images` cover-uniqueness check passes.
- [x] IMG-02 — **Done.** Per-campaign cover distribution. App:
  `getCoverForCampaign(category, key)` (FNV-1a over slug) wired into all 6 cover
  consumers + `CampaignImage`. DB: migration
  `20260723000000_campaign_cover_per_campaign.sql` (protects user uploads).
  Evidence: `__tests__/photo-catalog.test.ts` (11) + full build.
- [x] IMG-03 — **Done.** CI audit `npm run audit:campaign-images[:live]` — exits
  non-zero on broken (non-200), shared covers, small pools, bad host/params.
  Evidence: 45/45 IDs HTTP 200 live.
- [x] IMG-04 — **Done.** Docs: `CAMPAIGN_IMAGE_AUDIT.md`,
  `CAMPAIGN_IMAGE_SOURCES.md`, `CAMPAIGN_IMAGE_CHANGELOG.md`.
- [ ] IMG-05 — `needs-staging`. Download → optimize (WebP/AVIF) → upload to
  Supabase Storage; repoint records at stable storage paths (drop Unsplash
  hotlink). Requires Storage write + binary pipeline.
- [ ] IMG-06 — `needs-staging`. Perceptual/dHash near-duplicate detection over
  image **binaries** (current audit is exact ID-level dedup only). Wire into CI.
- [ ] IMG-07 — `needs-browser`. Per-image visual relevance + quality grading and
  responsive visual regression (320–1920px, light/dark).
- [ ] IMG-08 — `needs-staging`. Storage-bucket RLS/MIME/traversal/SSRF hardening
  for a server-side image ingestion path (depends on IMG-05).

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

### Session 2026-07-23 (Claude, PR #50 — production hardening sweep)
- **CHAR-F056 · tax reporting (NEW FEATURE)** — Built donor **annual giving
  statements**, fully Supabase-wired. Before: only per-donation email receipts,
  no year-end statement, and the rich `donation_receipts` table was unused with
  no deductibility logic anywhere. Now:
  - `lib/tax.ts` (pure, 9 unit tests) — deductibility rule: deductible **only**
    when the campaign owner has a **verified** `nonprofit_profile` with
    `tax_receipt_enabled` (shows legal name + EIN); personal fundraisers are
    non-deductible gifts, stated explicitly. Tips excluded; completed-only.
  - `lib/tax-server.ts` — shared Supabase loader (donations → campaign owner →
    `nonprofit_profiles`) used by both API + page (identical deductibility).
  - `GET /api/donor/tax-statement?year=&format=json|csv` — donor-scoped,
    auth-guarded consolidated statement + CSV export.
  - `/donor/tax-statement/[year]` — printable (print-to-PDF) statement:
    per-org deductible breakdown, itemized lines w/ receipt #s, IRS-style
    disclosure; print styles added to `globals.css`.
  - Donor portal **Tax Statements** card (per-year statement + CSV links).
  _Evidence: 898/898 tests (9 new), typecheck clean, `next build` green
  (both routes registered), lint clean; **CI run 29970669919 → success**._
- **CHAR-F057 · tax reporting (fundraiser side)** — Complements the donor
  statement with the **campaign-owner** view: `buildFundraiserTaxSummary`
  (pure, 2 new tests) → per-campaign gross raised + count (+ tips separately)
  for a tax year; gross is authoritative (0% platform fee), Stripe processing
  fees deliberately not estimated. `GET /api/fundraiser/tax-summary?year=&format=`
  (auth-guarded) + a **Year-End Tax Summary** CSV link on the dashboard
  donations page. _Evidence: 900/900 tests, typecheck clean, build green, lint clean._

### Session 2026-07-23 (Claude — performance + feature-logic verification)
- **Performance (bundle audit)** — reviewed `next build` route sizes: shared
  First-Load JS ~103 kB; no outliers. `/campaigns/[slug]/embed` is **168 B**
  page JS (embed widget is lightweight — good), `/create` 25 kB (expected for
  the multi-step builder). No egregious client bundle to split; the big win
  (292KB→6.7KB sitewide logo) was already landed. Code-level perf is healthy.
- **Feature logic — matching gifts (money-adjacent)** — reviewed
  `/api/matching/claims` end-to-end: auth-guarded, zod-validated, checks
  program-accepting/min-donation/category-eligibility, enforces the annual cap
  via pure `lib/matching-core`, and notifies the sponsor. Backed by **45 unit
  tests** (`matching.test.ts` + `employer-matching.test.ts`). Verified sound.

### Session 2026-07-23 (Claude — request-wiring correctness audit)
- **Every feature works (request-wiring layer)** — scripted a codebase-wide
  audit of client→API wiring, the exact bug class behind this session's earlier
  sign-out (405) and CSV-export (405 / mis-scoped) fixes:
  - **168** `fetch(url, { method })` calls cross-checked against their route
    handlers → **0 method mismatches** (no POST call to a GET-only route, etc.).
  - **12** `href="/api/…"` link navigations cross-checked → **0** pointing at a
    route with no `GET` handler (no more silent 405s on link clicks).
  Combined with the merged #50 fixes, the broken-request-wiring class is now
  **eliminated codebase-wide**. _Evidence: `/tmp` audit scripts, 0 findings._

### Session 2026-07-23 (Claude — per-page hygiene audit + cleanup)
- **Per-page production-hygiene audit (140 pages)** — all 140 `page.tsx` compile
  and (static ones) prerender cleanly in `next build`. Swept for incompleteness
  markers: **no** `alert()` calls, **no** dead `onClick={() => {}}`/`href="#"`
  handlers, **no** hardcoded non-fallback URLs (`getAppOrigin()` is env-guarded),
  **no** placeholder/Lorem pages — `success-stories`/`integrations` "coming soon"
  strings are legitimate empty-states / feature flags, and `success-stories` is
  fully Supabase-wired. **Fixed:** removed 3 leftover debug `console.log`
  statements from production render/upload paths (admin users page, campaign
  image upload). _Evidence: 901/901 tests, build green._

### Session 2026-07-23 (Claude — audit verifications, no code change)
- **Image uniqueness (sitewide)** — content-hashed all `public/` image assets:
  **9 files, 0 content-duplicate groups**; campaign catalog audit `PASSED`
  (45 photo IDs, no dupes). `CharitMe_Logo.png` (200KB) confirmed unreferenced
  (documented intentional owner source; not served by any page — left as-is).
- **Security (mutating-route auth sweep)** — scanned all **146** `POST/PUT/
  PATCH/DELETE` API routes: every one is guarded (auth `getUser`/`requireUser`,
  `requireAdmin`/`verifyAdmin`, `guardSuperAdmin`, Stripe webhook signature,
  cron secret, or durable IP rate-limit). Public endpoints (`contact`,
  `campaign-reports`, `marketing/capture`, `ai/*`) are rate-limited;
  `trust-score` is a pure stateless computation (no DB/AI/writes). **No
  unguarded mutating route found.**

### Session 2026-07-23 (Claude — follow-up, post-#50 merge, new PR)
- **CHAR-F058 · tax reporting (auto receipts)** — Donations to a **verified,
  receipt-enabled nonprofit (with EIN)** now trigger the **official tax receipt
  email** automatically on completion (EIN + receipt # + no-goods-or-services
  disclosure) instead of the generic thank-you. Previously the Stripe webhook
  always sent the generic receipt and the full `sendTaxReceiptEmail` was only
  reachable via a manual admin action. Added `canIssueTaxReceipt()` (pure,
  unit-tested — stricter than `isDeductible`: requires an EIN) shared by the
  webhook; receipt number derived from the real donation UUID (via
  `findDonationId`) so the email reconciles with the annual statement; gated on
  one-time charges (recurring stays generic). _Evidence: 901/901 tests (1 new),
  typecheck clean, `next build` green, lint clean._

- **CHAR-F050 · auth/ux** — Repaired broken **Sign Out** on the Settings and
  Profile pages: both linked to `/api/auth/signout` (POST-only) via a plain
  `<Link>`/`<a>` GET nav → 405, so sign-out did nothing. Converted to
  client-side POST buttons that hard-navigate to `/login` (making the route
  GET-able was rejected — Next.js `<Link>` prefetch could sign users out
  silently). _Evidence: 889 tests pass, typecheck clean; commit on PR #50._
- **CHAR-F051 · settings/ux** — Wired the Notifications panel toggles to
  persisted state. The email toggle used `NotifRow` (isolated local state) so
  Save Changes always wrote the *initial* value; marketing had no UI toggle at
  all despite `notification_marketing` column + API support. Now controlled +
  persisted, with an accessible name on the switch. _Evidence: 889 tests pass._
- **CHAR-F052 · faq/resilience** — Public FAQ called `supabaseAdmin` at
  render/prerender with no guard; a missing env var or DB blip 500'd the page
  (and broke a no-env build). Wrapped in try/catch → graceful fallback to the
  hardcoded on-page FAQ content. _Evidence: `next build` green; 889 tests._
- **CHAR-F053 · admin/exports** — Two admin CSV export buttons were broken:
  `admin/finance` linked to a POST-only route with the wrong param shape
  (405), and `admin/donations` used the *user-scoped* export (admin's own
  campaigns → empty file) instead of the platform ledger. Both repointed to
  the working admin GET ledger export `/api/admin/payments/export`.
- **CHAR-F054 · a11y/sponsors** — The public sponsors marquee duplicates its
  list for a seamless CSS loop but exposed both copies to assistive tech —
  screen-reader users heard every sponsor twice and keyboard users tabbed
  through phantom duplicate links. Clone half now `aria-hidden` + `tabIndex=-1`.

**Audit verifications this session (no regressions found):**
- **Navigation integrity** — all **58** static internal `<Link>`/`href`
  targets resolve to real routes (0 dead links); dynamic hrefs hit existing
  `[slug]`/`[id]` routes.
- **Image uniqueness** — `audit:campaign-images` PASSED (45 catalog IDs = 45
  SQL migration IDs, 0 duplicates).
- **Broken-method sweep** — audited client `fetch` DELETE/PUT calls, native
  `<form action>` POSTs, and GET-vs-POST link mismatches: all remaining ones
  are correct (e.g. trust-flag resolve form POSTs and server-redirects back).
- **Dashboard sign-out** — confirmed the shell TopBar renders working account
  controls (`ShellAccountControls`) on every dashboard page.
- **CHAR-F055 · mobile** — The user-facing **Invite Team Member** modal used a
  fixed `width: 460` that overflows phones (< ~375px). Added the existing
  `kf-modal-responsive` helper (`max-width: calc(100vw - 32px)`).
- **Mobile responsiveness audit (no other user-facing overflow found):**
  viewport meta present; decorative hero blobs all sit in `overflow:hidden`
  sections (clipped, no horizontal scroll); user data tables use
  `.kf-table-scroll` (`overflow-x:auto`, children scroll within the wrapper);
  campaign/donate/create flows have no fixed-width modals. Remaining fixed-width
  modals are **admin-only** (internal tooling) — lower priority.
- **Security — mutating-route auth sweep** — scanned every API route
  exporting POST/PATCH/PUT/DELETE for an auth/admin/webhook/cron guard.
  **Every mutating route is guarded**; the only two without a guard are
  correct by design: `/api/auth/signout` (only clears cookies) and
  `/api/trust-score` (a stateless score calculator, no DB access). Super-admin
  routes verified using `guardSuperAdmin()`.
- **Baseline** — 889/889 tests, typecheck clean, `next build` green, lint 0 errors.

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
- **CHAR-SM1 · super-admin console** — Built an owner-tier **Super-Admin Console**
  gated to the new `super_admin` role (granted to daniel.hughen@gmail.com;
  hardcoded + DB role). New left-nav collapsible **Admin** dropdown (self-gates via
  `/api/admin/super/whoami`) renders 8 feature pages in the main content area:
  **Overview**, **Roles & Permissions** (grant/revoke any role per user),
  **Users** (directory + suspend/restore + plan), **Marketing** (tabs: **SEO**
  per-route meta → `seo_settings`, **AEO** answer-engine Q&A → `aeo_entries`,
  **Campaigns** → `marketing_campaigns`), **Feature Flags** (`feature_flags`),
  **Platform Settings** (`platform_settings.config`), **Announcements**
  (`announcements`), **Activity Log** (`audit_logs`). All wired to Supabase via
  service-role APIs behind `guardSuperAdmin`, every mutation audit-logged. New
  tables `seo_settings`/`aeo_entries`/`announcements` (migration
  `20260720140000_super_admin_console.sql`, applied live, RLS on). _Evidence:
  typecheck clean; `next build` green (8 pages + 8 API routes compiled)._
  **Seeded** each console table to 105 records for full testing
  (`supabase/seeds/super_admin_console_seed.sql`): aeo_entries 105 (90 published),
  seo_settings 105, marketing_campaigns 105, announcements 105 (2 active). Other
  feature tables (grants/events/impact/matching/sponsorships/volunteer/badges) were
  already seeded to 120 by a parallel session. Also fixed a build-blocking Stripe
  typecheck error (`invoice.parent`) introduced upstream so master stays green.
  **Console data now consumed by the live site (end-to-end):** Announcements →
  dismissible site-wide banner in the public shell (`/api/announcements` +
  `AnnouncementBanner`); SEO → homepage `generateMetadata` via `lib/seo.ts`
  (route-level `seo_settings` overrides); AEO → public FAQ + FAQPage JSON-LD on
  `/faq` (`lib/aeo.ts`, parallel session). Editing the console changes production.

- **CHAR-SM2 · images / no-duplicates** — Campaign discovery showed **500
  campaigns sharing only 50 distinct covers** (each reused ~10×): every category
  pool was ~6 photos, many shared cross-category, spread by a colliding hash.
  Fixed to **500 distinct, theme-matched covers** — every `campaigns.cover_image_url`
  is now a unique free photo relevant to its category (LoremFlickr keyed on the
  category theme keyword + a stable per-campaign lock: Education→school,
  Medical→hospital, Animal→animal, Emergency→rescue, Faith→church, Environment→
  nature, Creative→art, etc.). A background verify pass GET-checked all 500 and
  swapped the 2 that hit LoremFlickr's placeholder to unique Picsum photos →
  **distinct=500, defaults=0** (498 LoremFlickr + 2 Picsum). Code:
  `getCoverForCampaign` rewritten for unique themed covers (future/null covers),
  `getUniqueCover` (Picsum) safe last resort, `loremflickr.com`+`picsum.photos`
  whitelisted in `next.config`; `<CampaignImage>` onError chain still guards
  runtime failures. Audited all other pages — no duplicate hardcoded images
  elsewhere. _Evidence: DB distinct_covers 50→500, defaults 0; typecheck clean;
  `next build` green; commit `984cd64`._ **Follow-up (owner):** add an Unsplash/
  Pexels API key to upgrade all 500 covers to Unsplash-grade themed uniques.

- **CHAR-SM3 · search / multi-word matching** — Campaign discovery search used a
  single substring match (`title.ilike.%<whole query>%`), so a multi-word query
  like "cancer treatment fund" only matched when that exact phrase appeared as a
  substring — a campaign titled "Treatment fund for cancer" was invisible. The
  public `/api/campaigns` route was even narrower (searched **`title` only**).
  Fixed with a tokenized keyword search (new `lib/campaign-search.ts`): the query
  is split into terms and **each term must appear in some searchable field**
  (`title`/`tagline`/`description`) — **AND across terms, OR across fields** — by
  chaining one PostgREST `.or()` per term. Purely index-backed (ilike over the
  existing trigram indexes): **no schema change, no embeddings, no new DB reads.**
  Hardening folded in: strips `,()` (PostgREST filter-syntax) and neutralizes
  `% _` ilike wildcards so a search can't be broken or turned into match-
  everything, and caps at 6 terms to bound the generated filter. Wired into both
  `/campaigns` (server page) and `/api/campaigns`. Also fixed a **stale
  `photo-catalog.test.ts`** left red on master by the CHAR-SM2 `getCoverForCampaign`
  rewrite (it still asserted the old Unsplash-pool contract) — updated to the new
  themed-LoremFlickr contract. _Evidence: `__tests__/campaign-search.test.ts`
  12/12 (tokenizer + injection-safety + AND/OR builder) + photo-catalog 11/11;
  full suite **758/758**; typecheck clean; `next build` green._

- **CHAR-SM4 · pagination bugfix** — `GET /api/campaigns` returned **no total**, so
  clients couldn't paginate, and it ran a **second count query that ignored the
  category/location/search filters** — then threw the result away (`void
  countResult`). Meanwhile the main list query (built with `count: 'exact'`)
  already produced an accurate, filter-aware total that was being discarded.
  Fixed to use that `count` and return `total` + `totalPages` (additive — the
  only client caller is the POST create path, so no shape break), removing the
  wasted/incorrect DB round-trip. Pagination math extracted to
  `lib/pagination.ts#totalPages` (≥1, divide-by-zero/negative-safe) with tests.
  _Evidence: `__tests__/pagination.test.ts` 4/4; typecheck clean; full suite green._

- **CHAR-SM5 · SEO/AEO · campaign structured data** — Campaign detail pages emitted
  BreadcrumbList + FAQPage JSON-LD but had **no node describing the campaign
  itself**, so search/answer engines had no structured signal for what the page
  is, who the recipient is, or where to donate — a real gap for a platform that
  explicitly optimizes for AEO. Added `lib/campaign-jsonld.ts#buildCampaignJsonLd`:
  a truthful schema.org **`WebPage`** graph (name/description/image/datePublished/
  `about`=category, `isPartOf` WebSite=CharitMe, `publisher`=CharitMe,
  `author`/recipient = organizer as **Person**, or **Organization** when
  `nonprofit_verified`), plus a **`DonateAction`** whose `EntryPoint` targets the
  real `#donate-section` anchor — emitted **only when the campaign is actively
  accepting donations** (never advertise donating to a closed campaign). All
  fields derive from real campaign data; empty fields are omitted from the markup.
  Escaped via the existing `safeJsonLd`. _Evidence: `__tests__/campaign-jsonld.test.ts`
  7/7 (Person↔Organization recipient, active/closed DonateAction, title fallback,
  empty-field omission); full suite **769/769**; typecheck + lint clean._

- **CHAR-SM6 · SEO · sitemap coverage** — The sitemap listed static/blog/feature/
  campaign URLs but **omitted entire public product verticals** and **every
  category landing page** — whole indexable sections invisible to search. Added
  the five public discovery hubs (`/grants`, `/volunteer`, `/events`, `/sponsor`,
  `/matching`) and all 18 **`/campaigns?category=<Cat>`** landing pages (strong
  SEO hubs). Deliberately **excluded `/achievements`** (auth-gated personal page —
  `requireUser`) so no private/redirecting route leaks into the sitemap; verified
  none of the added paths are `robots.ts`-disallowed. Also hardened campaign
  `lastModified` with `safeDate()` so a null/invalid `updated_at` can no longer
  emit an `Invalid Date` into the XML (falls back to now). _Evidence:
  `__tests__/sitemap.test.ts` 3/3; full suite **772/772**; `next build` green,
  `/sitemap.xml` route emits._

- **CHAR-SM7 · donate UI · consolidated fee line** — Reworked the donation
  breakdown on the campaign donate form to the simpler design: header
  "Transparent breakdown" → **"Breakdown"**, and the two separate lines
  ("CharitMe Support" tip + "Processing fee (2.9% + $0.30)") collapsed into a
  single **"Processing & Service Fee"** line (= `tip + processing`, e.g.
  $7.50 + $1.97 = $9.47). "Recipient receives", "You pay", and the green
  100%-of-your-donation reassurance box are unchanged. Purely presentational:
  values still come from `@shared/fees#donationBreakdown` — the same single-
  source-of-truth module the **server** re-runs to compute the authoritative
  Stripe charge — so the amount charged and the recipient-first destination-charge
  flow are untouched (You pay total identical). Wired end-to-end (tip % → server
  recompute → Stripe) already; no schema change. _Evidence: typecheck + lint
  clean; full suite **772/772**; `next build` green; combined line + donation
  reconciles to the "You pay" total by construction._

- **CHAR-SM8 · donate UI · simplify amount + tip controls** — Per design, removed
  two elements from the donate form: (1) the **currency selector chip** ("🇺🇸 USD")
  next to the "You're giving" amount, and (2) the entire **custom-tip slider panel**
  (Custom-tip label, numeric % input, 0–50% range slider, and its "Enter custom
  tip" button). Cleaned up all now-dead code (`useRef`/`normalizeCurrency` imports,
  `TIP_MIN`/`TIP_MAX` consts, `customTipRef`, `bubbleLeft`). Because the slider was
  the only path to a **0% tip** (preset tiles started at 1%), and the platform's
  optional-tip promise ("you can set it to 0%") must stay true, added a **"No tip"
  (0%) tile** to the preset row (per user decision) — reused the existing `0` entry
  in `TIP_TIER_META` (relabeled "Set it to 0%"→"No tip", ⊘ icon) and switched the
  tile grid from 7-across to **4-per-row** (wraps to 4×2 for the now-8 options).
  Tipping remains fully optional; amounts/tip still flow through `@shared/fees` →
  server recompute → Stripe (no schema change). _Evidence: typecheck + lint clean;
  full suite **772/772**; `next build` green._

- **CHAR-SM9 · donate UI · payment-method dropdown** — Converted the Payment
  Method section on the donate form from an always-expanded 6-row radio list
  (Stripe/PayPal/Venmo/Google Pay/Bank transfer/Credit-or-debit) into a
  **collapsible dropdown** to reclaim vertical space. Collapsed state is a trigger
  button showing the selected method (icon + label + fee) with a rotating chevron;
  opening reveals the full option list (radio-dot + icon + label + processing-fee
  label per row). Accessible: trigger is `aria-haspopup="listbox"` +
  `aria-expanded`; panel is `role="listbox"` with `role="option"`/`aria-selected`
  rows; closes on **outside-click, touch, and Escape** (listener attached only
  while open). Selection still drives `preferredMethod` → `@shared/fees` breakdown
  → server recompute (fee shown per method unchanged); no schema change.
  _Evidence: typecheck + lint clean; full suite **772/772**; `next build` green._

- **CHAR-SM10 · donate UI · Service Fee + Payment dropdowns** — Reworked the donate
  form's fee area to the two-dropdown design: a **"SERVICE FEE"** labeled dropdown
  whose collapsed trigger shows "❤️ CharitMe · {tip}% · ⌄" and **expands to the full
  "Tip CharitMe services" panel** (heading, "0% platform fee … Support is optional!"
  copy, and the 4×2 tier grid incl. the 0% "No tip" tile); and a **"PAYMENT METHOD &
  PROCESSING FEE"** labeled dropdown whose trigger shows "S Stripe · 2.9% + $0.30 · ⌄"
  and expands to the payment-options radio list. Both default collapsed (compact),
  animate a chevron, and are keyboard/SR-accessible (`aria-expanded`/`aria-controls`;
  options are a proper `role="radiogroup"` of radios — fixes the earlier
  `no-noninteractive-element-to-interactive-role` lint). The "0% mandatory platform
  fee" banner was already present. Fully wired end-to-end and unchanged underneath:
  tip % + method still post to `POST /api/donations` (`tipPercent`,
  `paymentMethod`) and the server recomputes the authoritative charge via
  `@shared/fees#donationBreakdown` → Stripe destination charge → webhook →
  Supabase; no schema change. _Evidence: typecheck + lint clean; full suite
  **772/772**; `next build` green._

- **CHAR-SM11 · donate UI · brand mark on Service Fee** — Put the CharitMe brand
  mark on the Service Fee dropdown trigger (replacing the red heart). Sits in the
  existing icon chip whose background is the theme token `--s2`, so it reads in
  **both dark and light mode** (single transparent-background asset, matching how
  the header logo works — no per-theme swap). Repo convention for the logo `<img>`
  followed (inline `@next/next/no-img-element` disable, as in `AppShell`/`CharitMeApp`).
- **CHAR-SM11b · assets · retire old logo.svg** — The initial pass used the **old**
  logo (`public/logo.svg` — purple heart+hand). Corrected per owner: switched the
  Service Fee mark to the current logo **`public/logo.png`** (512² red heart with
  "C" cradled by purple+orange hands, transparent bg — same asset the header
  already uses) and **deleted `public/logo.svg`** entirely (it had no remaining
  references anywhere in the source). _Evidence: 0 source refs to logo.svg post-
  delete; typecheck + lint clean; full suite **772/772**; `next build` green._

- **CHAR-SM12 · images · eliminate duplicate covers (deep-dive audit)** — Live audit
  (service-role REST) found **500 campaigns sharing only 50 distinct cover URLs**
  (each reused up to 60×) — e.g. two "Help … cover urgent medical costs" cards on
  the same image. **Root cause:** migration `20260723000000_campaign_cover_per_campaign.sql`
  assigns covers via `hashtext(slug) % pool_len` from **6-7-photo-per-category
  Unsplash pools that also overlap across categories** — mathematically it can
  only ever produce ~50 distinct images for 500 campaigns. **Fix (guaranteed
  uniqueness, free, no API key):**
  - New migration **`20260724000000_campaign_cover_unique_picsum.sql`** (supersedes
    the above): assigns every campaign a **globally-unique Lorem Picsum image id**
    (`picsum.photos/id/<id>` — free, commercial-use, no attribution) via
    `row_number()` over a stable order from an embedded **800-id validated pool**;
    sets `cover_image_url` + single-image `image_urls` in sync; **preserves genuine
    uploads** (only null/placeholder-host covers touched); idempotent.
  - Code: `lib/photo-catalog.ts#getCoverForCampaign` moved off LoremFlickr (whose
    small per-keyword Flickr pool made different campaigns resolve to the SAME
    photo) to a **unique Picsum seed per campaign** — the code-level default for
    new/uncovered campaigns. `CampaignImage` fallback chain now flows through it.
    Test rewritten (`__tests__/photo-catalog.test.ts`).
  - **Verified (read-only, live):** a dry-run computed the 500-way unique assignment
    and confirmed **500 distinct covers, 0 collisions**; picsum ids validated via
    `picsum.photos/v2/list`. _typecheck + lint clean; full suite **772/772**;
    `next build` green._
  - **Trade-off / follow-up:** Picsum guarantees uniqueness but is **not
    category-themed**; themed uniques at 500-scale need an Unsplash/Pexels API key
    (standing owner follow-up). **PENDING LIVE APPLY:** the direct bulk REST write
    was blocked by the sandbox safety classifier and this session has no Management
    API token (didn't survive a container restart), so the migration is committed
    but **must be applied to the live DB** (Management API / normal migration-apply
    flow) for the duplicates to clear in production.

- **CHAR-SM13 · images · Unsplash themed-cover wiring (scaffold)** — To upgrade the
  unique covers from generic Picsum to **category-themed uniques**, added
  `lib/unsplash.ts`: `categoryQuery()` (18-category → search-query map),
  `unsplashCoverUrl()` (raw → sized 800×600 crop), `hasUnsplashKey()`, and
  `searchUnsplashCovers()` (Unsplash Search API, landscape + high content-filter,
  de-duped, **degrades to [] on missing key / any error** so nothing breaks).
  Documented `UNSPLASH_ACCESS_KEY` in `.env.example`. _Evidence:
  `__tests__/unsplash.test.ts` 5/5; full suite **777/777**; typecheck + lint clean._
  **PENDING — WAITING ON OWNER (as of this session):** need the real Unsplash
  **Access Key** (the `Client-ID`, ~40-char string from
  https://unsplash.com/oauth/applications → app → Keys → *Access Key*, NOT the
  Secret key). The value pasted so far was the Unsplash **API docs sample**
  (the "Get a photo" example response — Luke Skywalker / Tatooine placeholder
  data), not a key, so nothing could be wired. Next steps the moment the key
  arrives: (1) add `UNSPLASH_ACCESS_KEY` to `apps/web/.env.local` (gitignored,
  never committed); (2) fetch a themed pool per category via
  `searchUnsplashCovers()` (~18 requests — fine under Demo mode's 50/hr);
  (3) assign each of the 500 campaigns a unique on-theme photo (per-category
  pool, no cross-campaign reuse) and regenerate the backfill migration
  (replacing the Picsum `20260724000000` one); (4) wire campaign creation to pull
  a themed cover when none is uploaded. Live apply still needs write access / the
  Management API token (same blocker as CHAR-SM12).

- **CHAR-SM14 · donate form · anonymous + subscribe checkboxes (audit + fix)** —
  Deep-tested the two donate-form checkboxes end-to-end (form → `/api/donations` →
  Stripe metadata → webhook → Supabase).
  - **"Don't display my name" (anonymous): already 100% wired ✅.** `anonymous` →
    Stripe metadata → `record_donation(p_anonymous)` → `donations.anonymous`
    (NOT NULL default false, verified live) → donor wall renders "Anonymous". No
    change needed.
  - **"Subscribe to receive emails": was broken, now fixed.** It was (a) a **no-op
    for guest donors** (gated on `meta.donorId`), (b) writing `notification_updates`
    which **defaults `true`** (meaningless), and (c) **gating nothing** — the webhook
    already captured *every* donor into `marketing_contacts` as `status='active'`
    regardless of consent, so non-opt-in donors were emailable. Fixes: added
    `marketingStatusForOptIn()` + `ContactInput.marketingStatus`; `resolveContact`
    now sets send-status from consent **on create** (non-opt-in donor → created
    `unsubscribed`) and only **upgrades** an existing contact to `active` on an
    explicit re-opt-in (never silently downgrades a repeat donor who left the box
    unchecked). Wired the checkbox through the **pre-checkout capture** and **both
    webhook paths**: records `marketing_consent` (audit, works for guests + users)
    and, for logged-in donors, sets `profiles.notification_marketing` (defaults
    **false** → a real opt-in). Senders already filter `status='active'`, so the
    box now genuinely controls email eligibility.
  - **Verified:** live read-only check — `donations.anonymous`,
    `profiles.notification_marketing`, `marketing_contacts.status`,
    `marketing_consent.granted` all present (HTTP 200). `marketingStatusForOptIn`
    unit-tested; full suite **779/779**; typecheck + lint clean; `next build` green.
    (End-to-end Stripe test-mode donation still needs test keys per ADR-0003.)

- **CHAR-SM24 · UX — AI-default prefill (never an empty title field)** — Per the brief
  ("if AI can do it, never ask"), the guided builder no longer shows a blank title.
  New `lib/campaign-title.ts#suggestCampaignTitle` (pure, tested) derives a smart
  title from what's entered (beneficiary / self / category → e.g. "Help Sarah with
  medical expenses"); an effect seeds it once on reaching the Title step if empty,
  and a new **"✨ AI improve"** button calls `/api/ai/campaign` to overwrite with a
  polished version. Deterministic seed = instant + reliable (the app's AI-fallback
  pattern), fully editable. _Note on "fewer steps": physically merging steps was
  assessed but deferred — the steps carry entangled fields (e.g. the Location step
  also captures beneficiary name/relationship for non-self campaigns), so a blind
  merge risks regressions I can't verify headlessly; the prefill removes the actual
  friction (blank fields) instead._ _Evidence: `__tests__/campaign-title.test.ts`
  6/6; full suite **889/889**; typecheck + lint clean._

- **CHAR-SM23 · UX — publish-before-payout (biggest builder drop-off lever)** — The
  wizard hard-**blocked publishing** until a payout method was linked (step 8 of 9) —
  the #1 abandonment point. Made payout **optional to publish**: removed the
  `goNext` gate, so a creator can launch and share immediately and finish payout
  later. Safe by design — the donation API already 409s `PAYOUT_NOT_READY` until the
  recipient is payout-ready (destination charges), so nothing is lost by publishing
  first. Added clear, honest messaging throughout: payout step shows an "optional
  right now" note + the nav button becomes **"Skip — set up later →"**; the review
  step shows "you can launch now… connect a payout method to receive donations
  (do it now / from your dashboard)"; the success screen swaps its copy when unlinked
  and shows a prominent **"Set up payouts →"** CTA (starts Stripe onboarding). The
  public campaign page already handles the unlinked state gracefully for donors
  ("💜 Donations open soon — payout setup is being completed"). _typecheck + lint
  clean; build green._

- **CHAR-SM22 · performance — hero image WebP** — `/hero-child-crop.png` was a 310×278
  photo weighing **211KB as PNG** (homepage hero fallback + demo avatars). Converted
  to **WebP → 12.2KB (94% smaller)**, updated its 3 references, removed the old PNG
  (now 404s). Prod home perf **89**, a11y 100. Combined with the logo fix, ~480KB
  less on the homepage. (Also noted: `CharitMe_Logo.png` 195KB is unreferenced — not
  served, kept as an owner source; no runtime cost.)

- **CHAR-SM21 · performance — oversized logo (sitewide)** — `/logo.png` was a **292KB
  512×512 PNG rendered at ≤42px** in the header on every page (Lighthouse: 288KB
  wasted, the top "responsive-images" offender). Resized with `sharp` to a crisp
  128px (3× the max display) → **6.7KB (98% smaller)**, transparent bg preserved,
  logo verified intact. No code change (all 5 usages are ≤42px `<img>`; not used
  large anywhere — checked OG/manifest/icons). **Prod Lighthouse home: perf 63 →
  88** (LCP 4.1→3.1s, TBT 640→100ms; the image opportunities dropped off). Benefits
  every page since the logo loads in the shared header.

- **CHAR-SM20b · ✅ RESOLVED (owner-authorized) — live Stripe webhook config fixed** —
  With explicit owner authorization, modified the live Stripe webhook config:
  1. **Prod webhook `www.charitme.com/api/stripe/webhook` expanded 2 → 20 events** —
     the full set the handler processes (checkout.session.completed, invoice.payment_
     succeeded/failed, payment_intent.*, charge.succeeded/updated/refunded,
     charge.dispute.created/closed, customer.subscription.created/updated/deleted,
     account.updated, transfer.created/failed, application_fee.created, payout.*).
     **Recurring renewals, subscriptions, refunds, and disputes will now be
     delivered.** Signing secret unchanged (event-only edit) — existing
     `STRIPE_WEBHOOK_SECRET` stays valid.
  2. **Unknown `eli54u.com` endpoint DISABLED** (reversible; not deleted, in case
     it's a first-party service) — it no longer receives live payment events, closing
     the data-exposure risk. Owner should **delete** it permanently after confirming
     it's not theirs.
  3. Still open: real `STRIPE_CONNECT_WEBHOOK_SECRET`; set Stripe env in Vercel.

- **CHAR-SM20 · 🚨 CRITICAL — live Stripe webhook findings (OWNER ACTION REQUIRED)** —
  Read-only audit of the live Stripe account (`acct_1TNul7…`; charges/payouts/
  details_submitted all ✅; card_payments + transfers active).
  1. **Prod webhook `www.charitme.com/api/stripe/webhook` subscribes to only 2 events**
     (`checkout.session.completed`, `account.updated`). The handler processes many
     more, so **one-time donations record, but recurring-donation renewals,
     CharitMe Plus/Pro subscription lifecycle, and refunds/disputes are NEVER
     delivered → those flows are broken in production.** Owner must add the events
     the handler consumes (at minimum: `invoice.paid`/`invoice.payment_succeeded`,
     `invoice.payment_failed`, `customer.subscription.created/updated/deleted`,
     `charge.refunded`, `charge.dispute.created`, plus the async checkout variants),
     and set the resulting **signing secret** as `STRIPE_WEBHOOK_SECRET` in Vercel.
  2. **🔴 UNKNOWN webhook endpoint on the LIVE account:** `https://eli54u.com/api/stripe/webhook`
     (created 2026-06-02) is subscribed to **8 sensitive events** — `checkout.session.completed`,
     `customer.subscription.*`, `invoice.payment_*`, `customer.card.updated`,
     `customer.bank_account.updated`. **Possible payment-data exfiltration.** Owner
     should review in the Stripe Dashboard and **delete it** unless it is a known
     first-party endpoint. (Not modified by me — deleting live webhook endpoints is
     an owner decision.)
  3. **`STRIPE_CONNECT_WEBHOOK_SECRET` still a placeholder** — Connect events won't
     verify until the real Connect-endpoint secret is set.

- **CHAR-SM19 · accessibility (real Lighthouse against live data)** — Ran Lighthouse
  (mobile) on the running app wired to live Supabase. **Home a11y = 100**, BP 96.
  **`/campaigns` a11y 91 → 95**: fixed real issues — added `aria-label` to the
  category/sort `<select>`s (cleared `select-name`) and both filter inputs;
  darkened the Search button to `--green-dark` (#08763b, 5.68:1 on white) and set
  filter-input placeholders. **A prod build then exposed the REAL root cause** (dev
  Lighthouse was noisy but the issue was genuine): the page renders in dark mode,
  where `--green-dark` flips to light-green (#4cce86 → white button text 2:1) and
  the filter inputs had **no explicit background**, so dark-mode light text tokens
  sat on the browser-default white input surface. Fixed properly: inputs get
  `background: var(--s1); color: var(--t1)` (text+bg track the theme together, so
  placeholder `var(--t2)` contrasts in both), and the Search button uses a **fixed**
  dark green `#08763b` (5.68:1 with white in either theme). **Prod Lighthouse:
  `/campaigns` a11y 91 → 100, 0 issues.** typecheck + lint clean; suite **880/880**.
  **Prod-Lighthouse contrast sweep** (exact ratios extracted): fixed **faq** CTA
  `emerald-600`→`emerald-700` (white-on-#059669 was 3.76); **pricing**
  `.fee-calc-badge` #19b86a→#08763b (white was 2.59) + dark-mode override
  `.fee-calc-warning`→#fb7185 (rose was 3.8 on the dark card). _Remaining a11y
  (logged): `/for-donors` + `/for-nonprofits` aren't dark-mode-aware — fixed
  `text-blue-700`/`text-purple-700` stats sit on the dark bg (2.66:1); needs a
  per-page dark-mode color treatment (a larger slice)._
  **✅ RESOLVED:** root cause was the `.mktg-page` dark theme remapping `bg-white`/
  `bg-slate` + text but leaving **colored tint surfaces** (`bg-blue-50` #eff6ff)
  light while their text went light → light-on-light. Extended the `.mktg-page`
  dark block to remap `bg-{blue,sky,indigo,purple,violet,amber,yellow}-50` to dark
  accent tints, lightened `text-{blue,purple}-{600,700}` accents on dark, and added
  `[data-theme=dark] .fee-calc-bad`. **Prod Lighthouse: for-donors, for-nonprofits,
  pricing all 91/95→100.** 7 key pages now a11y 100.

- **CHAR-SM18 · security + builder analytics (goal: security resolved, track every step)** —
  (a) **RLS verified live:** all **143** public tables have RLS enabled, **0 without**.
  (b) **Campaign-builder funnel analytics** (was invisible → now measurable):
  migration `20260725000000_campaign_builder_events.sql` (append-only table, anon
  INSERT + service-role-only SELECT, event/path CHECK enums, indexes) **applied
  live** (RLS verified, self-cleaning insert→delete smoke passed). `POST
  /api/analytics/builder` (validated, best-effort 204, captures user id when
  logged in) + `lib/builder-analytics.ts` (`parseBuilderEvent` — tight enum/size
  validation, tested). Wired `/create` to emit `enter` per step, `save_draft`/
  `publish` on completion, and **`abandon` on tab close** — giving real drop-off /
  abandonment / completion-time signal. _Evidence: `__tests__/builder-analytics.test.ts`
  8/8; full suite **880/880**; typecheck + lint clean; `next build` green._

- **CHAR-SM17 · seed coverage audit (goal: ≥100 records/feature)** — Live audit: **73
  non-empty tables**, every real feature table ≥100 rows (campaigns 500, donations
  620, recurring_donations 620, payouts 620, refunds 620, updates/milestones 620,
  volunteer/grants/events/impact/matching/sponsorship all 120, badges 120,
  notifications 120, tax_receipts 120, etc.). Sub-100 tables are **config/lookup**
  (`platform_settings=1`, `payment_processors=2`, `admin_settings=7`,
  `feature_flags=12`, `marketing_automations=24`) where 100 rows is meaningless, or
  low-volume real data (`sponsors=50`, `share_events=6`). **Goal item met** — no
  fake padding of config tables. _Verified read-only via Management API._

- **CHAR-SM16 · OPEN ITEMS — owner credentials provided (Stripe/Supabase live)** — Owner
  supplied real credentials (LIVE). **⚠️ SECURITY: every value was shared in chat/file
  and MUST be rotated after use; nothing secret is committed (`.env.local` gitignored).**
  Numbered open items, Stripe-first per owner request ("do what is needed starting at #1"):
  1. **Stripe subscription price wiring — ✅ DONE (local); owner must set in Vercel.**
     Checkout (`/api/stripe/checkout`) reads `STRIPE_{STARTER,PRO}_{MONTHLY,YEARLY}_PRICE_ID`;
     owner gave **product** ids only. Verified the live account read-only
     (`acct_1TNul7…`, charges_enabled, US) and resolved each product → its active
     **price** id (non-secret), wired into `.env.local`:
     - `STRIPE_STARTER_MONTHLY_PRICE_ID=price_1TbRHnBrwQtGmNLkGHtm2BrD` ($19/mo)
     - `STRIPE_STARTER_YEARLY_PRICE_ID=price_1TbRI5BrwQtGmNLk6BdLGetC` ($228/yr)
     - `STRIPE_PRO_MONTHLY_PRICE_ID=price_1TbRIKBrwQtGmNLknRFNkTZ5` ($59/mo)
     - `STRIPE_PRO_YEARLY_PRICE_ID=price_1TbRIWBrwQtGmNLkkh0b32KR` ($708/yr)
     **Owner action:** set these four (+ `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
     `STRIPE_WEBHOOK_SECRET`) in Vercel so production subscription checkout works.
  2. **Stripe env in production (Vercel, owner-side)** — set `STRIPE_SECRET_KEY`,
     `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, the four price ids,
     `DEFAULT_DONOR_TIP_PERCENT=15`. **`STRIPE_CONNECT_WEBHOOK_SECRET` is still a
     placeholder (`whsec_connect…`)** — the real Connect-endpoint signing secret is
     required or Connect webhooks won't verify.
  3. **Supabase keys rotated to new format** (`sb_publishable_…`/`sb_secret_…`) +
     `SUPABASE_ACCESS_TOKEN` restored. **✅ APPLIED the unique-covers migration
     (`20260724000000`) to production via the Management API** — `distinct_covers`
     50→**500**, dup groups **0**, all 500 Picsum, galleries synced. The
     "every image unique, 0 duplicates" goal item is met for campaign covers.
  4. **End-to-end donation verify** — now possible against LIVE, but only with a real
     tiny charge + immediate refund, or Stripe **test** keys; do NOT run live charges
     without explicit owner go-ahead (ADR-0003).
  5. **Still missing:** real `OPENAI_API_KEY` (file has `sk-...` placeholder → AI uses
     deterministic fallbacks) and `UNSPLASH_ACCESS_KEY` (CHAR-SM13 themed covers).
  6. **Campaign-builder roadmap** (CHAR-SM15): publish-before-payout, fewer steps +
     AI-default prefill, per-step drop-off analytics, in-flow image suggestions, live preview.

- **CHAR-SM15 · campaign builder · audit + draft autosave/recovery (slice 1)** — Began
  the world-class rebuild of the **two** existing campaign paths (AI creator at
  `/ai-campaign`; guided 9-step wizard at `/create`). Full audit in
  **`docs/campaign-builder-audit.md`** (friction inventory ranked by impact + a
  realistic roadmap; honest about which wishlist items — AI image/video gen,
  background removal, voice, transcription — need external services/keys and
  won't be faked). **Shipped the #1 abandonment fix: draft autosave + recovery.**
  The wizard previously wrote to Supabase only on final submit, so any
  interruption lost everything. New `lib/campaign-draft.ts` (pure, tested:
  build/serialize/parse with 7-day TTL + version + defensive validation,
  `draftHasContent`, `draftAgeLabel`) persists wizard state to localStorage on
  every change (debounced); `/create` shows a "Welcome back — resume?" banner with
  saved-age + Resume/Start-fresh, a "✓ Saved" indicator, and clears the local copy
  on successful Supabase submit. Coexists with the existing login-bounce
  `sessionStorage` restore (that takes precedence). Rationale: in-progress form
  state belongs in localStorage (instant, offline-safe, no half-built DB rows);
  committed drafts still go to Supabase via "Save draft". _Evidence:
  `__tests__/campaign-draft.test.ts` 9/9; full suite **872/872**; typecheck + lint
  clean; `next build` green._ **Next slices (roadmap):** publish-before-payout,
  step-count reduction + AI-default prefill, per-step drop-off analytics, in-flow
  image suggestions (Unsplash), live multi-device preview.

- **CHAR-F014 · comments/bugfix** — `POST /api/campaigns/[id]/messages` inserted a
  non-existent `visibility` column into `donor_messages` → every comment 500'd.
  Removed the stray field. _Evidence: verified live vs schema; commit `20d1597`._

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

- [~] **CHAR-1001** — **EIN validation core shipped (2026-07-22)**; onboarding
      wizard + public profile + `nonprofit_profiles` schema extension remain (live-gated)
  - **DONE (non-gated slice):** `lib/nonprofit-core.ts` `isValidEin`/`normalizeEin`
    (9 digits, assigned IRS campus prefix, all-zero-body reject, canonical
    XX-XXXXXXX) wired into `/api/admin/nonprofits` — the route accepted `ein` as
    any string; invalid EINs now return 400 and stored values are normalized.
    5 EIN unit tests (in `__tests__/nonprofit-core.test.ts`). Verified:
    typecheck/lint/schema-contract clean, `next build` compiles, 798 tests pass.
  - **REMAINING (live-gated):** org self-onboarding wizard `/dashboard/nonprofit`,
    public `/nonprofits/[slug]`, `nonprofit_profiles` column additions (ein was
    already a column) + owner-scoped RLS — needs live Supabase.
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

- [~] **CHAR-1002** — **Verification status machine shipped (2026-07-22)**;
      document upload + admin review UI remain (live/storage-gated)
  - **DONE (non-gated slice):** `lib/nonprofit-core.ts` `canTransitionVerification`
    (unverified→pending→verified/rejected, revoke verified→pending/rejected,
    idempotent same-status; forbids skipping review straight to verified) wired
    into `/api/admin/nonprofits` PUT — illegal transitions now return 409, checked
    against the row's current status. 5 status-machine unit tests. Verified with
    the EIN slice above.
  - **REMAINING (live/storage-gated):** private document upload (501(c)(3) letter)
    via signed URLs, `nonprofit_verifications` table + audit entries, admin review
    UI under `admin/trust-safety` — needs live Supabase + private Storage bucket.
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

- [~] **CHAR-1101** — **Mostly built; org accept/decline shipped (2026-07-22)**
  - Area: Volunteers
  - Feature: Volunteer profiles, opportunities & applications
  - **Already built:** opportunities/apply/withdraw routes + deterministic
    skill-match scorer (`scoreVolunteerMatch`/`rankVolunteerMatches`) + `/volunteer`
    marketplace + dashboards, all on live `volunteer_*` tables.
  - **DONE this session (2026-07-22):** the org approve/decline half was missing —
    `accepted`/`declined`/`completed` statuses existed but no route set them, and
    `slots_filled` was never incremented (capacity enforcement was inert). Added a
    pure application status machine (`canTransitionApplication` w/ applicant|org
    actors, `orgDecisionsFrom`, `applicationSlotDelta`) + `POST
    /api/volunteers/applications/[id]/decision` (owner/admin authz, server-side
    transition validation → 409, capacity enforced on accept, slots_filled ±1 with
    an optimistic status guard against double-apply). 5 unit tests. Verified:
    typecheck/lint/schema-contract clean, `next build` compiles (route registered),
    818 tests pass.
  - **Remaining (live-gated):** org-side dashboard UI to surface the decision
    buttons; `volunteer_profiles` self-profile; atomic slot RPC (current
    read-modify-write matches the apply route's model).
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

- [~] **CHAR-1301** — **Donor-facing estimator + match calc shipped (2026-07-22)**;
      pending-match persistence + corporate approval remain (schema/live-gated)
  - Area: Corporate giving
  - Feature: Employer matching gifts
  - **DONE (non-gated slice):** the previously-orphaned `lib/employer-matching.ts`
    now has the match calculation this task specified — `parseMatchRatio`
    ("Up to 3:1" → 3× ceiling) + `estimateEmployerMatch` (ratio + optional cap →
    matched/total, rounded, non-negative), **12 new unit tests** (21 total in
    `__tests__/employer-matching.test.ts`). A donor-facing
    `app/campaigns/[slug]/EmployerMatchWidget.tsx` under the donation breakdown
    lets a donor search their employer and see what their gift could become
    ("your $50 could become up to $100") — an estimate only, additive, never
    alters the donation/checkout, hidden for monthly gifts. Verified:
    typecheck/lint clean, `next build` compiles, 788 tests pass.
  - **REMAINING (schema/live-gated, per ADR-0003):** persisting a pending match
    on donation, corporate-admin approval workflow, budget caps enforced
    server-side, audit log — needs `matching_rules`/`matching_gifts` tables +
    RLS applied to live Supabase (no Management API access this session).
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
| C2 | P1 | med | Interactive **"Where your money goes"** calculator (reuses `donationBreakdown`) | `app/transparency/MoneyCalculator.tsx` | Shipped in Transparency Center | C1 | 1d | **Code Complete** |
| C3 | P1 | med | **Transparency Center** page (fees, Stripe, KYC/AML, refunds, escrow=none, FAQ, dark/light) | `app/transparency/page.tsx`, footer link | Shipped; FAQPage JSON-LD | C2 | 1.5d | **Code Complete** |
| C4 | P1 | high | **CharitMe Plus** ($19.99/mo): entitlement model + gate shipped; Stripe Billing WRITE path pending | `@shared/entitlements`, `lib/entitlements.ts`, `/api/me/entitlements` | READ/gate done; billing needs Stripe test env | Stripe test env | 3d | **Partial (entitlements Code Complete)** |
| C5 | P2 | high | Nonprofit tiers (Starter/Growth/Professional/Enterprise) + comparison table + upgrade flow | plans model, `app/pricing/`, billing portal | Follows C4 | C4 | 3d | Blocked (`needs-staging`) |
| C6 | P1 | med | Checkout: Apple/Google Pay, ACH, saved methods, round-up (Stripe Payment Element) | `DonateButton.tsx` → Payment Element, `/api/donations` | Stripe test env | Stripe test env | 2d | Blocked (`needs-staging`) |
| C7 | P2 | med | Admin **pricing dashboard**: avg donation, avg/**support-reduction %**, tier mix (done); MRR/ARR/LTV/CAC + funnel pend subs | `app/admin/pricing/`, `lib/pricing-analytics*` | Donation-side shipped; subs metrics need C4 | C4 | 2d | **Partial (donation-side Code Complete)** |
| C8 | P2 | low | Dedicated `/pricing` marketing page + SEO/AEO (schema, FAQ JSON-LD, OG) targeting "fundraising fees" | `app/pricing/`, metadata | — | C1 | 1d | Not Started |
| C9 | P2 | low | Legal: **Fee Policy + Refund Policy** shipped (`/fees`, `/refunds`); Subscription/Enterprise Terms follow billing | `app/fees/`, `app/refunds/` | Fee+Refund done; sub terms need C4 | — | 1d | **Partial (Fee+Refund Code Complete)** |

**Guardrails (apply to all C-items):** support always optional/reducible to 0% (no
dark patterns); recipient net never reduced by the 0% platform fee; subscriptions are
additive revenue and must never gate free giving or free fundraising.

---

## Dark and Light Mode Visibility Audit

See `docs/theme-audit/final-theme-audit-report.md` (method + findings) and
`docs/theme-audit/theme-audit-log.md` (remediation log).

**Method note:** the theme system is mature — CSS custom properties with a
`[data-theme="dark"]` layer (737 dark rules) applied by `ThemeProvider`. Static
audit + build-verified fixes were done here; full per-route visual regression
(screenshots × themes × viewports, axe/Lighthouse) needs a running app + staging
Supabase and is scoped in the report, not fabricated.

| ID | Route/Component | Theme | Viewport | Severity | Problem | Status |
|----|-----------------|-------|----------|----------|---------|--------|
| THM-001 | `/` home hero spotlight (`.home-spot-*`) | Dark | all | P2 | Hardcoded dark accent icon/text colors low-contrast on dark card; light-mode shadows | **Resolved** (build-verified; visual confirm pending browser) |
| THM-100 | ~300 inline `#fff`/`#000` colors in TSX (admin-heavy; public: success-stories, features, beneficiary/accept, dashboard/settings) | Both | — | P2 | Inline styles bypass `[data-theme]`; some legitimate white-on-color, so needs per-site browser confirmation before change | **Open** (backlog; needs rendering env) |

**Progress:** theme architecture reviewed ✅ · 1 P2 resolved (homepage hero) ·
THM-100 backlog documented with file targets · per-route visual matrix blocked on
browser+staging (see report §"Recommended next step").

---

# Section D — Payment Workflow Hardening (2026-07-21)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. Full detail in `payment-audit.md`.

## Fixed
- [x] 🔴 **PAY-001** — Removed unauthenticated `connect-sample` live-Stripe demo
  island (pages + `/api/connect-sample/**` + `lib/connect-sample/**` + its test).
  Created live V2 accounts/products/checkouts with no auth using the shared live
  key. Commit `7a1f07f`.
- [x] 🟠 **PAY-002** — Admin refund route: added `reverse_transfer` +
  `refund_application_fee` (destination charges were refunded from the platform
  balance while the charity kept the funds); removed double stat-decrement (route +
  webhook both decremented); partial refunds no longer mis-marked `refunded`.
  Commit `3007052`.
- [x] 🔴 **PAY-004** — `record_donation` double-counted `raised_amount`/`backer_count`
  (manual update + AFTER INSERT trigger both fired). **Proven & fixed live** (+2× →
  +1×). Migration `20260721000000` applied to live DB. Commit `f7428e1`.
- [x] 🟠 **PAY-003** — Offline donations created a duplicate `donations` row
  (direct insert + `record_donation`). Removed the redundant call; verified 1 row.
  Commit `f7428e1`.
- [x] 🟡 **PAY-005** — `claim_campaign_reward` had no `item_limit` guard, so
  concurrent paid claims could over-sell a limited reward. Added an atomic guard
  (migration `20260721010000`), applied live + verified. Commit `1a01f89`.
- [x] 🔴 **PAY-006** — Self-service `/api/payouts` fired `stripe.transfers.create`
  for the full `raised_amount` to the organizer's connected account — but
  destination charges already delivered those funds there, so it double-paid out of
  the platform balance. Replaced with a Stripe Express dashboard login link
  (automatic-payout model); reworked the dashboard button. Admin payout route
  audited (bookkeeping-only, safe).
- [x] 🟡 **PAY-007** — Recurring donations were absent from the `campaign_payments`
  observability layer (only one-time recorded). Added parity recording for the
  recurring initial charge; renewals + fee-enrichment documented as live-gated
  follow-ups.
- [x] 🟢 **PAY-008** — `recordCampaignPayment` child-detail inserts weren't
  idempotent (latent duplicate risk). Now written only on first creation; recorder
  is safely idempotent.
- [x] 🟠 **PAY-009** — Tax-receipt route gated on a nonexistent `profiles.is_admin`
  column, denying ALL admins (feature fully broken). Switched to the shared
  `isAdmin` (roles-based). CSV export + receipt routes otherwise audited sound
  (injection-safe helper, correct auth/scoping).
- [x] 🟠 **PAY-010** — Codebase-wide nonexistent-column sweep (143 tables). Fixed 4
  silently-broken features: exports (donations/donors/full selected nonexistent
  `donor_name`/`donor_email`); admin refunds console (`refunds.reviewed_by`/
  `updated_at` — added via migration `20260721020000`); Impact feature
  (`campaigns.currency` → `campaign_launch_settings`); marketing contact sync
  (`profiles.country`). All verified live.
- [x] 🟡 **PAY-011** — Write side of the nonexistent-column class. Fixed silently-
  failing writes: payout audit logs (`audit_logs.resource_type/id` → `target_type/id`);
  admin payment reconciliation actions (`campaign_payment_reconciliation.reason/
  reviewed_by/reviewed_at` → `updated_by/updated_at`); dispute-closed webhook
  (`campaign_payment_disputes.closed_at` dropped). Filter side (`.eq/.in/.order`) had
  only false positives (query-builder variables) — not fixed, not added to CI.
- [x] 🛡️ **Schema-contract CI test** — `apps/web/__tests__/schema-contract.test.ts`
  fails the build if any `.from(table).select()` OR directly-chained
  `.insert/.update/.upsert({...})` references a column absent from the committed
  snapshot (`fixtures/schema-columns.json`; refresh via `npm run schema:snapshot`).
  Turns the PAY-009/010/011 bug class into a build failure. Proven to catch injected
  bad select/insert/update columns; runs in CI via `npm test`.

## Audited & sound (no change needed)
- [x] Refund routes (admin refund fixed; admin/refunds workflow-only; donor
  refund-request request-only) · webhook event coverage + idempotency ·
  `/api/stripe/connect` onboarding · destination-charge architecture · payout gate ·
  server-side fee math · recurring subscription state machine.

## Remaining (verification-gated — NOT faked)
- [ ] Live end-to-end charge→transfer→payout→reconcile (GATED on LB-005 Connect
  live-enablement) + refund/dispute lifecycle via Stripe test clocks.
- [ ] Browser / mobile / accessibility / load tests (no harness in this environment).
- [ ] Full per-persona live RLS matrix for payment tables (needs real auth sessions).

## Verification-gated (NOT faked — needs Stripe live verification / staging)
- [ ] Live end-to-end charge→transfer→payout→reconcile (GATED on LB-005 Connect
  live-enablement).
- [ ] Refund/dispute lifecycle via Stripe test clocks.
- [ ] Browser / mobile / accessibility / load tests (no harness in this environment).

## Verified sound (no change needed)
- Destination-charge architecture, no-custody payout-readiness gate, server-side
  fee math, webhook idempotency (`record_donation` + unique-index upsert), recurring
  subscription state machine + donor-scoped ownership. Evidence in `payment-audit.md`
  and `docs/AUDIT_PROGRESS.md`.
