# RaiseMoney

RaiseMoney is an AI-first fundraising platform built around trust, speed, donor confidence, and campaign growth.

The product is not positioned as another crowdfunding website. It is designed to become the safest and smartest way to raise money online: a trusted fundraising network with AI-assisted campaign creation, donor-facing trust signals, transparent payouts, and growth guidance.

## Product Moat

- AI Trust Engine: campaign completeness, identity, payout, image, duplicate-story, and fraud-risk signals.
- AI Campaign Copilot: a fast campaign creation flow that helps organizers tell clear, authentic stories.
- AI Growth Engine: campaign health scoring, share recommendations, donor outreach prompts, and update nudges.
- Transparency Ledger: milestone, receipt, payout, and impact tracking for donor confidence.
- Fast payout path: Stripe Connect-based payouts with future risk scoring for accelerated access.

## Current Structure

```text
apps/web              Next.js App Router application
packages/shared       Shared fee and category utilities
supabase/schema.sql   Initial database schema and RLS policies
render.yaml           Current hosting config
AGENTS.md             Engineering and agent rules
```

## Local Setup

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:3000`.

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
ADMIN_EMAILS=
```

## Core Commands

```bash
npm run typecheck
npm run build
```

## Implementation Priorities

1. Harden payment trust: webhook idempotency, payout verification, and fraud-risk gates.
2. Add rate limiting to public mutation endpoints.
3. Add migrations and CI.
4. Build the real AI Campaign Copilot and Trust Engine behind the current deterministic scaffolding.
5. Add campaign updates, receipt tracking, image upload validation, and donor share kits.
6. Add Playwright smoke tests for create, donate, auth, and dashboard flows.
