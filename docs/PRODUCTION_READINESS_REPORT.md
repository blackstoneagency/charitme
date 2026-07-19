# CharitMe — Production Readiness Report

> Living document. Honest status, not aspirational. Updated as verified work lands.
> (Note: some agent directives reference a "FamilyOS" household app — that template
> does not match this repo. CharitMe is an AI-first fundraising/philanthropy platform;
> this report reflects the actual application.)

## Executive summary

CharitMe is a **mature, largely Supabase-wired** Next.js 14 (App Router) platform, not a
greenfield build. Baseline before recent work: ~102 pages, ~138 API routes, 40+
migrations, ~80+ tables with RLS, type-clean build, hundreds of passing unit tests.

Recent verified additions (merged to `master` via PR #11 and follow-ups): Sponsorship
marketplace, GDPR/CCPA privacy (export + deletion), Corporate matching gifts, Events
(RSVP + check-in), Impact tracking + Transparency Score, Gamification persistence
(badges/challenges), and a homepage hero refresh. Master also carries a canonical
Volunteers and Grants implementation.

**Launch recommendation:** not yet launch-certified. Core flows are built and unit-tested,
but full production certification requires the live-credential and end-to-end steps listed
under *Blockers* below. Reads and typed/build/test gates are green; live payment, AI, and
RLS-against-prod verification are gated on credentials.

## Verification status (this repo, current branch)

| Gate | Status | Evidence |
|------|--------|----------|
| `tsc --noEmit` | ✅ pass | run locally |
| `vitest run` | ✅ pass | 500 tests / 32 files |
| `next build` | ✅ pass | all routes emit |
| Lint (via build) | ✅ no new warnings | build output |

## What is verified vs. what remains

**Fully verified (code + typed + built + unit-tested):**
- Marketplace slices (volunteers, sponsors, grants, matching), events, impact,
  gamification, privacy — schema + RLS policies (mirrored to `schema.sql` and
  regression-tested via policy-logic simulation), API authorization, state machines,
  and pure business logic.
- In-app notification wiring for sponsorship/matching/event status changes.

**Verified with documented limitation:**
- RLS is unit-simulated, not yet asserted against a live Postgres with real sessions.
  A per-persona live RLS harness is the recommended next step (needs a Supabase test project).
- Migrations are additive + idempotent but several are not yet applied to prod
  (sponsorships, privacy, matching, events-extension, impact, gamification).

**Externally blocked (need credentials / infra — see Blockers):**
- End-to-end payment (Stripe **live** keys configured; needs **test** keys + webhook
  forwarding to certify without moving real money).
- AI features (`OPENAI_API_KEY` masked in env) — incl. the not-yet-built Semantic search.
- Live email/SMS delivery (Resend/Twilio).

## Blockers

| ID | Severity | Description | Owner action |
|----|----------|-------------|--------------|
| B1 | Critical (security) | Live secrets were pasted into chat (Supabase service-role/access-token/DB-password, Resend, Google OAuth, CRON). | **Rotate all.** |
| B2 | High | `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` masked/placeholder in env; Stripe **product** IDs given where **price** IDs are needed. | Fill real values; use Stripe **test** keys for verification. |
| B3 | High | New migrations not yet applied to prod Supabase. | Apply migrations (idempotent) via Supabase Management API / SQL editor. |
| B4 | Medium | No live per-persona RLS/E2E harness. | Provision a Supabase test project + Playwright E2E. |

## Next actions (resumable)

1. Rotate leaked secrets (B1) and fill real env values (B2).
2. Apply pending migrations to prod (B3), then run a live RLS spot-check.
3. Build **Semantic search** (pgvector + embeddings) once `OPENAI_API_KEY` is live.
4. Stand up Playwright E2E covering: donate flow, campaign create, and one full
   marketplace loop (post → apply/offer → accept), plus tenant-isolation cases.
5. Wire status-change **emails** (Resend) alongside the in-app notifications already added.
