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

**CI** (`.github/workflows/ci.yml`) runs typecheck · lint · test · campaign-image
audit · build on every PR and push to `master`. A weekly job
(`image-links.yml`) re-verifies every campaign image still resolves (HTTP 200).

## Supabase

Run:

```bash
supabase db reset
```

Or apply manually:

1. `supabase/schema.sql`
2. `supabase/seed.sql` for staging/demo data

## Guides

- `docs/stripe-setup.md`
- `docs/openai-setup.md`
- `docs/vercel-deployment.md`
- `docs/production-readiness.md`

## Important Production Notes

This codebase is wired for production deployment, but real production launch still requires real Supabase projects, Stripe webhook registration, verified Connect settings, OpenAI/Resend keys, legal policy pages, compliance review, and live payment QA.
