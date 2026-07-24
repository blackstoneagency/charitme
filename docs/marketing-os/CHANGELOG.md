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
