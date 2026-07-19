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

- [ ] CHAR-0001
  - Area: Grants
  - Feature: Grants data model + RLS
  - Description: Migration for `grants`, `grant_matches`, `grant_applications`, `grant_documents`, `grant_deadlines` with FKs, indexes, timestamps, soft-delete, and RLS (public read of open grants; org-scoped applications).
  - Agent: 1 (+5)
  - Priority: P1
  - Dependencies: none
  - Database: new tables + RLS
  - API: none (this task)
  - UI: none (this task)
  - Security: RLS tenant isolation for applications
  - Tests: RLS test suite (org A cannot read org B applications)
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0002
  - Area: Grants
  - Feature: Grant discovery + AI matching + application workflow
  - Description: `/grants` discovery (search/filter/deadline), saved grants & alerts, application drafts with document collection and submission/status tracking; `/api/ai/grant-match` wired to `lib/ai-platform.ts`.
  - Agent: 5 (+6 for AI)
  - Priority: P1
  - Dependencies: CHAR-0001
  - Database: reads CHAR-0001 tables
  - API: `/api/grants`, `/api/grants/[id]/apply`, `/api/ai/grant-match`
  - UI: `/grants`, `/dashboard/grants`
  - Security: server-side authz per role
  - Tests: unit (matching), integration (application lifecycle)
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0003
  - Area: Volunteers
  - Feature: Volunteer data model + RLS
  - Description: `volunteer_profiles`, `volunteer_skills`, `volunteer_opportunities`, `volunteer_applications`, `volunteer_shifts`, `volunteer_hours` with RLS.
  - Agent: 1 (+5)
  - Priority: P1
  - Dependencies: none
  - Database: new tables + RLS
  - API/UI/Security/Tests: model-only; RLS tests
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0004
  - Area: Volunteers
  - Feature: Volunteer marketplace + matching + hours tracking
  - Description: Opportunity creation/search, applications/approvals, scheduling & shifts, check-in/out, hours verification, AI skills matching.
  - Agent: 5 (+6)
  - Priority: P2
  - Dependencies: CHAR-0003
  - Completion Evidence: —
  - Commit: —

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

- [ ] CHAR-0012
  - Area: Security / hardening
  - Feature: RLS coverage audit + automated RLS tests
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
