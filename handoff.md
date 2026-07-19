# CharitMe — Handoff Log

> Continuously updated coordination doc. Each workstream records what it owns,
> what it changed, and what the next agent needs. Newest entries on top.

## File / workstream ownership

| Agent | Workstream | Branch | Owned Directories | Shared Files (Agent 0 only) | Status |
|-------|-----------|--------|-------------------|------------------------------|--------|
| 0 | Orchestration / integration | `agent/orchestration` | root docs (`todo.md`, `handoff.md`, `architecture.md`, `decisions.md`) | `package.json`, lockfiles, `app/layout.tsx`, `globals.css`, env schema, routing | Active |
| 1 | Supabase / data / security | `agent/supabase` | `supabase/migrations/**`, `lib/supabase*.ts`, `lib/roles.ts` | RLS policies, generated types | Not started |
| 2 | Campaigns / organizer | `agent/campaigns` | `app/create/**`, `app/dashboard/campaigns/**`, `app/campaigns/**`, `app/api/campaigns/**` | — | Not started |
| 3 | Payments / payouts | `agent/payments` | `app/api/stripe/**`, `app/api/donations/**`, `app/api/payouts/**`, `lib/stripe.ts`, `lib/payment-*.ts`, `lib/pricing.ts` | `@shared/fees` | Not started |
| 4 | Donor / discovery / social | `agent/donors` | `app/donor/**`, `app/donors/**`, `app/leaderboard/**`, `app/api/saved-campaigns/**`, `lib/gamification.ts`, `lib/leaderboard.ts`, `lib/referrals.ts` | — | Not started |
| 5 | Nonprofits / corporate / grants / sponsors / volunteers | `agent/nonprofits` | `app/beneficiary/**`, `app/sponsors/**`, `app/api/sponsors/**`, `app/api/beneficiaries/**`, `lib/employer-matching.ts` | — | Not started |
| 6 | AI / marketing automation | `agent/ai-marketing` | `app/api/ai/**`, `app/admin/marketing/**`, `lib/ai-platform.ts`, `lib/openai.ts`, `lib/marketing-*.ts`, `lib/organizer-marketing.ts` | AI provider abstraction | Not started |
| 7 | Trust / safety / compliance | `agent/trust-safety` | `app/api/admin/trust/**`, `app/api/campaign-reports/**`, `lib/risk.ts`, `app/trust-safety/**`, `app/privacy/**` | RLS policies | Not started |
| 8 | UX / design system / mobile / a11y | `agent/mobile-design` | `components/**`, `app/globals.css`, marketing pages | `globals.css`, `layout.tsx` (coordinate w/ Agent 0) | Not started |
| 9 | Admin / analytics / QA / observability | `agent/admin-qa` | `app/admin/**`, `app/api/admin/**`, `__tests__/**`, `e2e/**`, `lib/payment-admin-data.ts` | test config | Not started |

## Entries

### 2026-07-19 — Agent 0 — Phase 1 audit + coordination scaffolding
- **Completed**: Full repo audit. Established real baseline (see `architecture.md`): 102 pages, 138 API routes, 41 migrations, ~80 wired Supabase tables, 339 tests passing, type-clean. Created `architecture.md`, `handoff.md`, `decisions.md`, restructured `todo.md` into an execution tracker.
- **Files changed**: `architecture.md`, `handoff.md`, `decisions.md`, `todo.md` (root, docs only — no app code).
- **Key finding for all agents**: The platform is **already largely built and healthy** — this is a hardening/gap-closure/elevation program, not a greenfield build. Do NOT rewrite working subsystems. Find genuine gaps, close them as verified vertical slices.
- **Blocker for all agents**: Dev sandbox **cannot reach live Supabase** (short/placeholder keys; data routes 500 locally). "Tested end-to-end / real donations" verification requires a **staging Supabase project + Stripe test keys**. Until then, verification is limited to typecheck, unit/integration tests (Vitest with mocked Supabase), build, and static UI/responsive checks.
- **Prior recent work on `master`** (context): dark-mode default, hero floating-card nudge, state business-license lead connectors, New Customers outreach tab.
- **Remaining**: Await prioritization of the gap backlog (see `todo.md` §Execution Backlog).
