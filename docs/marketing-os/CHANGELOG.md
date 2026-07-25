# Marketing OS — Changelog

## 2026-07-24 — Goal-Based Marketing (first slice)

Added the "tell CharitMe the outcome you want" entry point as a complete,
connected vertical slice.

- **DB**: `marketing_goals` table (migration `20260729000000`) — CHECK-enum
  metric/unit/priority/status, autonomy level, indexes, `updated_at` trigger,
  RLS (service-role only).
- **Domain**: `lib/marketing-goals.ts` — metric catalogue, deterministic
  natural-language → structured draft parser, live progress measurement against
  `campaigns` and `donations`.
- **API**: `/api/admin/marketing/goals` — GET (list + live progress), POST (NL
  preview / NL create / structured create), PATCH (lifecycle). `verifyAdmin` +
  zod + `marketing_audit_logs` on every mutation.
- **UI**: `/admin/marketing/goals` — NL composer, editable draft review, live
  progress bars, status controls; loading/empty/error/retry; mobile-responsive.
  Linked from the Marketing hub overview.
- **Tests**: `__tests__/marketing-goals.test.ts` (6, passing). Existing
  RLS/schema coverage suites still green.

Docs added: `MASTER_SPEC`, `ARCHITECTURE`, `DATA_MODEL`, `IMPLEMENTATION_STATUS`,
`KNOWN_LIMITATIONS`, this changelog.

## 2026-07-24 — Opportunity engine (second slice)

The "Prioritize" hop of the loop. Data-derived, scored opportunities that convert
straight into goals.

- **DB**: `marketing_opportunities` (migration `20260730000000`) — evidence jsonb,
  estimates, deterministic `score` (0–100), status lifecycle, `dedupe_key` unique
  index for idempotent re-generation, `linked_goal_id`, RLS service-role only.
- **Domain**: `lib/marketing-opportunities.ts` — `scoreOpportunity` (pure, tested)
  + `generateOpportunities()` deriving opportunities from real campaign category
  momentum (rising / declining / high-value) with the actual numbers in `evidence`.
- **API**: `/api/admin/marketing/opportunities` — GET (ranked), POST generate
  (idempotent upsert preserving human decisions), PATCH (status + **convert to
  goal**, which inserts a linked `marketing_goals` row). All audited.
- **UI**: `/admin/marketing/opportunities` — ranked cards with score, labelled
  estimates, accept/defer/reject, and one-click convert-to-goal; loading/empty/
  error/retry. Linked from the Command Center.
- **Tests**: `__tests__/marketing-opportunities.test.ts` (5 passing).

Estimates are always labelled as estimates; nothing is presented as fact.

## 2026-07-24 — Goal → multichannel campaign generation (third slice)

The "Create" hop of the loop. One goal becomes a connected, reviewable campaign.

- **DB**: `marketing_campaign_plans` + `marketing_campaign_plan_assets`
  (migration `20260731000000`) — plan linked to a goal; assets typed by
  channel; status lifecycles (plan: draft→in_review→approved; asset:
  draft→approved); cascade delete; RLS service-role only.
- **Domain**: `lib/marketing-campaign-generator.ts` — deterministic,
  brand-safe assembly of a landing page, outreach email, 3 social posts, SEO
  metadata, and an FAQ from a goal's context (category/geography/audience).
  No external AI required; unit-tested for connectedness + brand safety.
- **API**: `/api/admin/marketing/campaign-plans` (GET list/detail, POST
  generate-from-goal with orphan-rollback, PATCH plan status) and
  `.../campaign-plans/assets` (PATCH edit/approve). All audited.
- **UI**: `/admin/marketing/campaign-plans` — generate from a goal, list, and a
  detail view with per-asset inline edit + approve and plan-level review/approve;
  loading/empty/error/retry. "Generate campaign →" added to each goal card;
  linked from the Command Center.
- **Tests**: `__tests__/marketing-campaign-generator.test.ts` (5 passing).

Honest limit surfaced in the UI: external publishing needs connected channels
(none exist yet), so status stops at "approved" — no simulated publishing.

### Marketing OS status after three slices
Shipped & production-merged (PR #59): Goals, Command Center, Opportunity engine.
This branch adds Campaign generation. Remaining backlog unchanged (multi-tenant
scoping, approval engine, brand constitution, agents, external connectors,
experiments/attribution/forecasting) — see MASTER_SPEC.md.
