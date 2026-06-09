# CharitMe Platform Inventory

> Generated 2026-06-09 from a full crawl of the codebase. This is the source-of-truth map
> of every page, route, table, and integration in the platform.

## Stack

- **Frontend:** Next.js 14 App Router, React 18, inline-style design system + CSS variables (no Tailwind)
- **Backend:** Next.js Route Handlers + Supabase (PostgreSQL, RLS, Storage)
- **Payments:** Stripe (Checkout, Connect Express, webhooks), PayPal/Venmo/Google Pay/Sinch payout references
- **AI:** OpenAI via `lib/openai.ts` (campaign copilot, coach, content, goal recommendation)
- **Tests:** Vitest (11 suites in `apps/web/__tests__/`) + Playwright (`apps/web/e2e/smoke.spec.ts`)
- **Deploy:** Vercel (primary), Render fallback, Node 20

## Pages (84)

### Public / Marketing (28)
| Route | Purpose |
|---|---|
| `/` | Homepage with sponsor carousel, story rotator |
| `/about-us`, `/contact`, `/blog`, `/faq`, `/help` | Marketing & support |
| `/how-it-works`, `/pricing`, `/features`, `/features/[slug]` | Product marketing |
| `/for-donors`, `/for-individuals`, `/for-nonprofits` | Audience pages |
| `/ai-campaign`, `/ai-fundraising` | AI marketing/builder pages |
| `/trust-safety`, `/security`, `/privacy`, `/terms`, `/prohibited-use` | Trust & legal |
| `/success-stories`, `/fast-payouts`, `/supported-countries` | Conversion pages |
| `/campaigns`, `/campaigns/[slug]`, `/campaigns/[slug]/embed` | Browse + detail + embed |
| `/login`, `/forgot-password`, `/donor`, `/profile` | Auth/account |

### Campaign creation
- `/create` — 8-step wizard (type → location → story → title → goal → media → payout → review → live)
  with AI copilot, CharitMe Score rater, preview modal, guest mode + login modal, Quick Share on launch.

### Organizer Dashboard (24)
`/dashboard` plus: campaigns (list, detail, edit, analytics, faqs, ledger, settings, share, thank-donors, updates),
donations, donor, ai-coach, ai-growth-plan, analytics, integrations, messages, notifications, payouts,
recurring (+ cancel), refund, settings (+ MFA), team, updates (+ new).

### Beneficiary
- `/beneficiary/accept` — invite acceptance flow.

### Admin (26)
`/admin` plus: audit-log, campaigns, content, countries, donations, finance, payouts, reports, settings,
setup, sponsors, support, system, trust-safety, users, and the **payments observability suite**:
payments/campaign-flows (+ per-campaign + per-transaction drill-down), disputes, payouts, processors,
reconciliation, refunds.

## API Routes (97)

### Domain APIs
- **Campaigns:** CRUD, analytics, faqs, milestones, qr-poster, settings, thank, updates, rotator, stories, donations-toggle
- **Donations:** create (Stripe Checkout), receipt, recurring (+ cancel), refund-request, offline-donations
- **AI:** `ai/campaign`, `ai/coach`, `ai/content`, `ai/goal-recommend` — all OpenAI-backed with zod validation + rate limiting
- **Stripe:** checkout, connect (+ status), portal, webhook
- **Trust:** trust-score, campaign-reports
- **Beneficiaries:** invites (create/accept/resend), list
- **Misc:** auth (callback/signin/signout/reset), contact, exports (donations/donors/full), health,
  integrations, messages, notifications (+ count), payouts, platform-modules, profile, settings,
  share-events, sponsors, support-tickets, team-members, upload (campaign-image, profile-image)

### Admin APIs (34)
apply-schema, audit, campaigns (+ donations/updates), content, countries, donations
(+ note/receipt/refund/tax-receipt), nonprofits, payments (actions/export), payouts, refunds,
reports/export, seed-support, settings, sponsors, support, trust (flags resolve, reviews),
users (+ campaigns/donations/bulk).

## Database (70+ tables, 24 migrations)

### Core
`profiles`, `connected_accounts`, `campaigns`, `campaign_media`, `campaign_updates`, `donations`,
`donor_tips`, `platform_fees`, `payouts`, `subscriptions`, `refunds`, `webhook_events`

### Trust & Safety
`trust_scores`, `risk_flags`, `verification_documents`, `transparency_ledger_items`,
`admin_reviews`, `campaign_reports`, `campaign_status_log`, `admin_notes`

### Payment Observability (10 tables)
`campaign_owner_transfers`, `campaign_owner_payouts`, `campaign_payment_refunds`,
`campaign_payment_disputes`, `campaign_payment_reconciliation`, `campaign_payment_webhook_events`,
`campaign_payment_audit_logs`, `campaign_payment_admin_notes`, `campaign_payment_exports`,
`campaign_payment_settings`

### Growth / Parity (35+ tables)
creator_profiles, campaign_launch_settings, reward_tiers, nonprofit_profiles, donation_forms,
recurring_donations, donor CRM (contacts/segments/members), team_members, peer_fundraisers,
events (+ tickets/registrations), auctions (+ bids), giving_days, livestreams, memberships,
exclusive_posts, direct_messages, digital_products, orders, commissions, tips, embedded_buttons,
tax_receipts, email/sms campaigns, analytics (snapshots/events), integrations, api_keys, webhooks

### Platform
`platform_settings`, `audit_logs`, `sponsors`, `support_cases`, `contact_messages`,
`supported_countries`, `share_events`, `donation_receipts`, `ai_generations`

## Shared Logic (`apps/web/lib/`)

| File | Responsibility |
|---|---|
| `supabase-browser/server/admin (supabase.ts)` | Three-client pattern (anon browser / anon+cookies server / service-role admin) |
| `auth.ts`, `auth-config.ts` | getUser/requireUser, safe redirects |
| `stripe.ts` | Stripe client |
| `openai.ts` | OpenAI client + model config |
| `risk.ts` | Rule-based fraud flag detection (8 flag codes) |
| `rate-limit.ts` | API rate limiting |
| `roles.ts` | Role/permission checks |
| `payment-flow.ts`, `payment-flow-core.ts`, `payment-admin-data.ts` | Payment observability pipeline |
| `email.ts` | Transactional email |
| `ai-platform.ts` | AI feature wiring |
| `fees.ts` (packages/shared) | platformFee, netToFundraiser, categories, limits |

## Existing AI Capabilities (vs. roadmap)

| Capability | Status |
|---|---|
| AI Campaign Copilot (title/story/goal) | ✅ `api/ai/campaign`, `api/ai/goal-recommend`, in-wizard |
| AI Fundraising Coach | ✅ `api/ai/coach` + `/dashboard/ai-coach`, `/dashboard/ai-growth-plan` |
| AI Content / summaries / social posts | ✅ `api/ai/content` |
| Trust Engine (public score) | ✅ `calculateTrustScore` shown on campaign page; CharitMe Score in wizard |
| Fraud Detection | ✅ rule-based `lib/risk.ts` + admin trust-safety queue |
| AI Donation Optimizer | ❌ not built |
| AI Donor Matching / recommendations | ❌ not built |
| AI Impact Engine | ❌ not built |

## Test Coverage

Vitest suites: campaign-flows, donation-attribution, donation-guest-flow, feature-catalog, fees,
home-utils, notifications, payment-flow, risk, rls, trust. Playwright: smoke.spec.ts.
