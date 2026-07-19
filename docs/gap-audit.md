# CharitMe — Gap Audit

> Generated from a full crawl of `blackstoneagency/charitme` on 2026-07-19 on branch
> `claude/charitme-github-integration-tbaz3i`. This is the honest, evidence-based map of what
> is **actually built and wired to Supabase** versus what is **genuinely missing** relative to
> the full production feature inventory. It supersedes the stale counts in
> `docs/platform-inventory.md` (which reported 84 pages / 97 routes / 70 tables).

## Repository health (verified this audit)

| Check | Command | Result |
|---|---|---|
| Type checking | `npm run typecheck --workspace=apps/web` | ✅ 0 errors |
| Unit tests | `npm run test --workspace=apps/web` | ✅ 339 passing / 18 files |
| Production build | `npm run build --workspace=apps/web` | ✅ succeeds |
| App pages | `find apps/web/app -name page.tsx` | **102** |
| API route handlers | `find apps/web/app/api -name route.ts` | **138** |
| SQL migrations | `supabase/migrations` | **41** |
| DB tables (`CREATE TABLE`) | migrations | **109** |
| TypeScript LOC | `apps/web` | ~71,000 |

**Conclusion:** this is a mature, healthy, largely Supabase-wired platform — not a greenfield
build. The bulk of the "world-class" roadmap already exists in some form. The remaining work is
(a) a handful of genuinely-absent domains, and (b) cross-cutting production hardening.

> **Environment caveat:** this session has **no live credentials** (`NEXT_PUBLIC_SUPABASE_URL`,
> `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY` are all empty). Work can be
> typechecked, unit-tested, and built here, but end-to-end verification against a live Supabase /
> Stripe / OpenAI must happen in an environment that has secrets configured. No task may be marked
> **Verified** on the strength of a compile alone.

---

## A. Built & Supabase-wired (evidence-backed)

Grouped by domain. Each entry cites a representative route/table so it can be spot-checked.

### Auth & accounts — ✅ built
- Email login/signup, password reset, OAuth callback: `app/login`, `app/forgot-password`,
  `api/auth/{callback,reset-password,signin,signout,sync-profile}`.
- MFA: `app/dashboard/settings/mfa`. Profile: `api/profile`, `profiles` table + `auth_profile_bootstrap` trigger.
- Roles/permissions: `lib/roles.ts`, `ADMIN_EMAILS`.

### Campaigns — ✅ built (deep)
- Create wizard (`app/create`), edit, settings, faqs, milestones, updates, rewards, ledger, share,
  supporters, thank-donors, analytics, payout-setup: `app/dashboard/campaigns/[id]/*`.
- Public detail + browse + embeddable widget: `app/campaigns/[slug]`, `/embed`, `app/campaigns`.
- Tables: `campaigns`, `campaign_media`, `campaign_updates`, `campaign_rewards`, `reward_tiers`,
  `campaign_status_log`, `campaign_reports`, `beneficiary_invites`, `team_members`, `peer_fundraisers`.

### Donations / payments / payouts — ✅ built (deep)
- Stripe Checkout, Connect Express onboarding + status, billing portal, verified webhook:
  `api/stripe/{checkout,connect,connect/status,portal,webhook}`.
- Recurring (create/cancel/pause), refund requests, offline donations, tips, multi-currency:
  `api/donations/*`, `recurring_donations`, `donor_tips`, `refunds`.
- Full payment-observability suite (10 tables): transfers, payouts, refunds, disputes,
  reconciliation, webhook events, audit logs, admin notes, exports, settings —
  `campaign_payment_*`, admin drill-down at `app/admin/payments/*`.
- Tax receipts: `tax_receipts`, `donation_receipts`, `api/admin/donations/tax-receipt`.

### AI suite — ✅ built (14 endpoints)
`api/ai/{campaign,campaign-assistant,coach,complaint-resolver,content,donation-impact,
donor-conversion,fee-optimizer,fraud-monitor,goal-recommend,impact-summary,matching-finder,
payout-concierge,trust-score,viral-loop}`. All OpenAI-backed with deterministic fallbacks, zod
validation, rate limiting, and audit logging into `ai_generations`.

### Trust, safety & transparency — ✅ built
- CharitScore/Transparency: `lib/ai-platform.ts` + `lib/trust-signals.ts` (real signals from
  `profiles`, `connected_accounts`, `transparency_ledger_items`, `campaign_media`, `risk_flags`),
  surfaced publicly on campaign page and coached via `api/ai/trust-score`.
- Rule-based fraud engine `lib/risk.ts`, admin queue `app/admin/trust-safety`, `risk_flags`,
  `verification_documents`, `admin_reviews`, `campaign_reports`.

### Marketing engine — ✅ built (deep)
- Campaigns, automations, segments, audience, copilot, outreach: `app/admin/marketing/*`,
  `api/admin/marketing/*`, `api/marketing/{capture,unsubscribe}`.
- ~20 tables: `marketing_campaigns`, `marketing_automations`, `marketing_segments`,
  `marketing_contacts`, `marketing_consent`, `marketing_suppression_list`, `marketing_utm_links`,
  `email_campaigns`, `sms_campaigns`, etc.

### Discovery / community / gamification — 🟡 mostly built
- Browse, filters, rotator, stories, leaderboards, referrals, saved campaigns, share events,
  donor messages/likes: `api/{leaderboard,saved-campaigns,share-events,referrals}`,
  `lib/{leaderboard,gamification,referrals}.ts`.
- **Gap:** gamification is computed but not *persisted* — no `badges`/`user_badges`/`challenges`/
  `challenge_participants` tables (see B).

### Admin platform — ✅ built (deep)
`app/admin/*`: users, campaigns, donations, finance, payouts, reports, settings, setup, sponsors,
support, system, trust-safety, countries, content, audit-log, new-customers, and the payments suite.
Audit logging via `audit_logs`.

### Nonprofits / sponsors / corporate — 🟡 partial
- `nonprofit_profiles` table + `for-nonprofits` page + `api/admin/nonprofits`.
- `sponsors` (admin-managed logos/carousel) + `api/sponsors`.
- Employer match **estimator** widget (`EmployerMatchWidget`, `lib/employer-matching.ts`) — a
  client-side lookup, **not** a wired matching-gift workflow.

### Events — 🟡 partial
- Tables exist: `fundraising_events`, `event_tickets`, `event_registrations`, `giving_days`,
  `auction_items`, `auction_bids`, `livestreams`. **Public event pages / registration UI need
  verification** — no dedicated `app/events/*` routes found.

---

## B. Genuine gaps (net-new work, evidence of absence)

Verified absent by grep across `apps/web/app` + `supabase/migrations`:

| Gap | Evidence | Notes |
|---|---|---|
| **Volunteers** | 0 tables, 0 routes/pages (only "volunteer" as a campaign-category string) | Entirely missing: profiles, opportunities, applications, shifts, hours, matching. |
| **Grants** | 0 grant tables, 0 grant routes (text mentions only) | Missing: grant records, matching, applications, documents, deadlines, tracking. |
| **Corporate giving / matching gifts** | `matching_gift` = 0 files; only estimator widget | Missing: corporate accounts, employee giving, match rules/limits, approval routing, CSR dashboards. |
| **Sponsorship marketplace** | `sponsorship_agreement` = 0 files | `sponsors` is admin logos only; missing sponsor profiles, opportunities, requests, agreements, fulfillment. |
| **Gamification persistence** | no `badges`/`challenges` tables | Badges/achievements/challenges are computed, not stored or awarded durably. |
| **Privacy requests** | `privacy_request` = 0 files | Data-export/deletion requests are not recorded; GDPR/CCPA request workflow + consent audit table absent. |
| **Semantic search** | search is keyword/category only | No vector/embedding search over campaigns. |
| **Web push notifications** | in-app + email only | `notifications` table exists; no web-push subscription/delivery. |

---

## C. Cross-cutting hardening backlog

Not "missing features" but production-readiness work spanning the platform:

- **RLS test coverage** — `__tests__/rls.test.ts` exists; extend to every persona in the prompt
  (donor, organizer, beneficiary, team member, nonprofit admin, corporate admin, T&S, finance,
  support, super admin) and every new table.
- **Accessibility** — WCAG 2.2 AA audit of primary flows (auth, checkout, campaign builder, admin).
- **Security headers / CSP** — verify CSP, HSTS, and security headers in `next.config`/middleware.
- **Env validation** — fail-fast schema validation for required server secrets at boot.
- **Observability** — structured logging + correlation IDs across API routes; integration-health view.
- **`PRODUCTION_READINESS.md`** — launch certification doc (does not yet exist at repo root;
  `docs/production-readiness.md` is a 787-byte stub).

---

## D. Recommended sequencing

1. **Corporate matching-gift workflow** — highest donor-value, builds on the existing estimator.
2. **Volunteers** — self-contained new domain, clear schema, high strategic value.
3. **Grants** — self-contained new domain, pairs with existing `api/ai/matching-finder`.
4. **Gamification persistence + Privacy requests** — smaller, close real compliance/engagement gaps.
5. **Cross-cutting hardening + `PRODUCTION_READINESS.md`** — continuous.

Each should ship as a complete vertical slice (migration + RLS + API + typed UI + unit tests +
docs), typechecked/tested/built, committed, and opened as a draft PR.
