# CharitMe

CharitMe is a production-oriented AI-first fundraising platform scaffold.

Core positioning:
- Free fundraising powered by AI.
- Fundraising with built-in trust.
- The safest and smartest way to raise money online.

## What Is Included

- Next.js App Router, React, TypeScript, Tailwind CSS.
- Supabase Auth, Postgres schema, Storage-ready media records, and RLS SQL.
- Stripe Checkout, Stripe Connect Express onboarding, and webhook handling.
- OpenAI Campaign Copilot endpoint with deterministic local fallback.
- Resend receipt email helper.
- Public marketing pages: home, pricing, how it works, trust and safety, fast payouts, AI fundraising, individuals, nonprofits, donors, FAQ, contact.
- Campaign creation wizard with 8 steps.
- Public campaign pages with trust score, donation tiers-ready checkout, ledger, updates, recent donors, beneficiary details, and report flow.
- Organizer, donor, profile, and admin dashboard scaffolds.
- Seed data for staging/demo.
- Unit and E2E test scaffolding.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint --workspace=apps/web
npm run test --workspace=apps/web
npm run build

# Guards (also run in CI)
npm run audit:campaign-images --workspace=apps/web        # covers: unique, valid, live
npm run check:env --workspace=apps/web                    # env preflight (deploy)
```

**CI** (`.github/workflows/ci.yml`) runs two jobs on every PR and push to
`master`:

- **verify** — typecheck · lint · test · campaign-image audit · build
- **e2e** — Playwright (chromium + mobile), then a live-server sweep of
  `audit:contrast` (WCAG AA, both themes) and `audit:a11y` (axe). Both audits run
  before the step fails, so one red sweep does not hide the other's findings.

A weekly job (`image-links.yml`) re-verifies every campaign image still resolves
(HTTP 200).

### Runtime audits, locally

The `scripts/audit-*.mjs` suite needs a live server. Start one, then point the
audits at it — do not skip the `--base`, or they silently audit nothing useful:

```bash
npm run build --workspace=apps/web
cd apps/web && npx next start -p 4000 &

npm run audit:contrast     -- --base http://localhost:4000   # 86 pages x 2 themes
npm run audit:a11y         -- --base http://localhost:4000   # axe
npm run audit:responsive   -- --base http://localhost:4000   # x 3 viewports
npm run audit:mobile       -- --base http://localhost:4000   # overflow + tap targets
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npm run audit:focus-order -- --base http://localhost:4000  # real Tab presses
```

⚠️ `audit:web-vitals` cannot produce a trustworthy result without a reachable
database: every data-backed route stacks connection timeouts and reports 4–8s
TTFB that do not exist in production. Confirm against the real origin with
`curl -w "%{time_starttransfer}"` before optimising anything on its say-so.

## Environment variables

Copy `.env.example` to `.env.local`. The core set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, bypasses RLS
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ Beyond those, **18 more are read from `process.env` in app code**. A deploy
using only the core set silently loses payouts, subscriptions and all outbound
email — nothing fails loudly. The full list, grouped by what breaks without each,
is in `CLAUDE.md` under *Environment variables*. The short version:

| group | variables | silent failure |
|---|---|---|
| Payouts | `STRIPE_CONNECT_WEBHOOK_SECRET` | payout status never updates |
| Plans | `STRIPE_{STARTER,PRO}_{MONTHLY,YEARLY}_PRICE_ID` | checkout cannot resolve a price |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `CONTACT_EMAIL` | every email is dropped |
| Access | `ADMIN_EMAILS`, `CRON_SECRET` | no admins; cron locked out (fails safe) |
| AI | `OPENAI_API_KEY`, `OPENAI_MODEL` | degrades to deterministic fallbacks |
| Media | `UNSPLASH_ACCESS_KEY` | falls back to Picsum placeholders |

Run `npm run check:env --workspace=apps/web` before deploying — it is the
preflight for exactly this.

## Supabase

Fresh project:

```bash
supabase db reset          # applies supabase/schema.sql + migrations
```

Or apply manually in the SQL editor, in order:

1. `supabase/schema.sql` — full schema mirror
2. `supabase/migrations/*.sql` — in filename order
3. `supabase/seed.sql` — staging/demo data

### Cause landing content

The `/causes/[slug]` pages read two optional content tables. Without them the
pages fall back to live measured data, so these are additive:

| file | what it gives you |
|---|---|
| `migrations/20260824000000_cause_stories.sql` | "Stories from the Field" — editorial cards with optional video |
| `migrations/20260825000000_cause_impact_stats.sql` | owner-authored figures for the "Real Impact" band |
| `seed/cause_stories.sql` | 101 stories across all 20 causes |
| `seed/cause_impact_stats.sql` | the design's headline figures, **unpublished** |

Full setup, RLS behaviour and how to enable video cards: `supabase/seed/README.md`.

## Guides

- `docs/stripe-setup.md`
- `docs/openai-setup.md`
- `docs/vercel-deployment.md`
- `docs/production-readiness.md`

## Important Production Notes

This codebase is wired for production deployment, but real production launch still requires real Supabase projects, Stripe webhook registration, verified Connect settings, OpenAI/Resend keys, legal policy pages, compliance review, and live payment QA.
