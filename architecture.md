# CharitMe — Architecture (as-built, audited 2026-07-19)

> This documents the platform **as it actually exists today**, established by a
> real repository audit — not an aspirational design. It is the baseline all
> workstreams build on. Update it when structure changes.

## 1. Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), React 18, TypeScript 5 |
| Styling | Tailwind 3 + hand-authored CSS variables in `apps/web/app/globals.css` (no CSS modules) |
| Data / Auth / Storage | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| Payments | Stripe + Stripe Connect (Express) |
| AI | OpenAI (`openai` SDK) via `lib/openai.ts` + `lib/ai-platform.ts` |
| Email | Resend (`lib/email.ts`); SendGrid env also present |
| SMS | Twilio (env present) |
| Tests | Vitest (unit/integration, 339 passing), Playwright (e2e) |
| Deploy | Vercel (auto-deploy from `master`), Render fallback (`render.yaml`), Node 20 |

## 2. Monorepo layout

```
apps/web/            Next.js app
  app/               102 page routes + 138 API route handlers
  components/        AppShell, ui.tsx, ThemeProvider, etc.
  lib/               44 modules: supabase clients, stripe, auth, ai, marketing, risk…
  __tests__/         Vitest suites
packages/shared/     @shared/fees — platform fee math, categories, limits
supabase/
  migrations/        41 SQL migrations (system of record for schema)
  schema.sql         reference snapshot
```

## 3. Supabase client pattern (CRITICAL — never mix)

| File | Used in | Key | RLS |
|------|---------|-----|-----|
| `lib/supabase-browser.ts` | Client components | anon | enforced |
| `lib/supabase-server.ts` | Server components / Route Handlers | anon + `cookies()` | enforced |
| `lib/supabase.ts` (`supabaseAdmin`) | API routes only | service role | **bypasses RLS** |

Rule: `supabaseAdmin` must never be imported into client code. Every service-role
handler must do its **own** authorization (`lib/auth.ts`, `lib/roles.ts`) because RLS
is off for it.

## 4. Domain map (as-built)

- **Identity/roles** — `profiles`, `lib/roles.ts`, `lib/auth.ts`, `ADMIN_EMAILS`.
- **Campaigns** — `campaigns` + `campaign_media/updates/milestones/faqs/rewards/reports/status_log`, beneficiary invites, team members, transfers.
- **Donations & money** — `donations`, `recurring_donations`, `refunds`, `payouts`, `connected_accounts`, and a rich **payment-observability** layer (`campaign_payments`, `campaign_payment_events/refunds/disputes/reconciliation/webhook_events`, `campaign_platform_fees`, `campaign_processor_fees`). Fee math in `@shared/fees` + `lib/pricing.ts`.
- **Trust/risk** — `risk_flags`, `verification_documents`, `admin_reviews`, `lib/risk.ts`, `/api/ai/fraud-monitor`, `/api/ai/trust-score`, transparency ledger.
- **Marketing engine** — large subsystem: `marketing_campaigns/contacts/segments/automations/forms/utm_links/consent/suppression_list`, `email_campaigns`, `sms_campaigns`, `lib/marketing-*.ts`.
- **AI platform** — `ai_generations`, `lib/ai-platform.ts`, 14 `/api/ai/*` routes (campaign, coach, goal-recommend, impact, matching, fraud, complaint-resolver, payout-concierge, viral-loop…).
- **Growth/lead-gen** — `business_leads`, state business-license connectors, `lib/lead-*.ts`, admin "New Customers".
- **Admin** — 40+ `/api/admin/*` routes across users, campaigns, donations, payouts, refunds, trust, marketing, sponsors, settings, audit.

## 5. Key flows (as-built)

- **Donation**: `POST /api/stripe/checkout` (or `/api/donations`) → Stripe Checkout → webhook `checkout.session.completed` → `increment_campaign_stats` RPC → donation + observability rows.
- **Payout**: `POST /api/stripe/connect` → Connect Express onboarding → status callback marks `stripe_onboarded`. Platform fee = 5% via `application_fee_amount` when organizer has connected Stripe.
- **Auth**: `middleware.ts` refreshes session; `/create` & `/dashboard` gated; OAuth/email confirm → `/api/auth/callback`.

## 6. Known constraints / risks (audited)

1. **Live production**: `master` auto-deploys to `charitme.com` handling real money. WIP must stay on branches; only verified slices reach `master`.
2. **No live Supabase in the dev sandbox**: local env keys are non-standard/short and the sandbox cannot reach Supabase (data routes time out → 500 locally). Data-dependent, payment, payout, and RLS flows **cannot be verified end-to-end from here** — they require a staging project with real credentials.
3. **Shared working tree**: other agent sessions (Codex) edit this checkout live — always check branch/diff before committing.

## 7. Baseline health (2026-07-19)

- `tsc --noEmit`: **pass**
- `vitest run`: **339 passed / 18 files**
- Homepage renders; dark mode default; no horizontal overflow at mobile widths.
