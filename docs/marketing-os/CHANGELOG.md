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
