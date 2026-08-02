# Composite image — testing report

Every figure below was produced by running the command shown, on 2026-08-02,
against a production build served on `:4123`. Nothing here is asserted from
reading code.

## Automated suites

| Gate | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | **0 errors** |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Unit / integration | `npm test` | **2590 passed, 231 files** |
| Production build | `npm run build` | **EXIT=0** |

New tests added for this work (41 assertions):

- `__tests__/share-page-core.test.ts` — 15 tests
- `__tests__/sponsors-core.test.ts` — 11 tests
- `__tests__/internships-core.test.ts` — 15 tests

## Accessibility

```
npm run audit:a11y -- --base http://localhost:4123
→ ✅ 0 axe violations across 164 page loads (84 routes × 2 themes)
```

Tags: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.

```
npm run audit:focus-order -- --base http://localhost:4123
→ ✅ No keyboard traps, invisible focus stops, or focus-order breaks
   82 pages × 2 themes · 14,351 focus stops examined
```

## Responsive

```
npm run audit:mobile -- http://localhost:4123 --only /partner,/internships,/search,
  /leaderboard,/transparency,/reports,/volunteer,/feedback,/causes
→ ✅ No horizontal overflow across 18 page loads
→ ✅ No tap targets under 24px at 320px (WCAG 2.2 SC 2.5.8)
```

Full-site figure from the same build: **0 overflows across 199 routes ×
{320, 390} px**, public and signed-in.

## Contrast

```
npm run audit:contrast -- --base http://localhost:4123 --only /partner,/internships
→ ✅ No AA contrast failures across 2 pages × 2 themes
```

Full-site figure: **0 AA failures across 196 pages × 2 themes**, both light and
dark measured separately.

## The share page was measured SEPARATELY, and here is why

`/campaigns/[slug]/share` is registered in the sweeps under the fixture slug
`security-header-fixture`, which **does not exist in this database**. The sweeps
therefore *skip* it — correctly, and by the same rule that already applies to
`/campaigns/security-header-fixture/embed`.

That means the site-wide numbers above **do not cover the share page**, and
reporting it as covered would have been false. It was measured directly against a
real seeded campaign instead:

```
curl -o /dev/null -w "%{http_code}" .../campaigns/campaign-123-b1ad88b8/share  → 200

node scripts/probe-overflow.mjs <base> /campaigns/campaign-123-b1ad88b8/share 320
  → content 320px — no unclipped element crosses the edge
node scripts/probe-overflow.mjs <base> /campaigns/campaign-123-b1ad88b8/share 390
  → content 390px — no unclipped element crosses the edge

axe (wcag2a/2aa/21a/21aa/22aa), both themes
  → light: 0 violations · dark: 0 violations
```

## What is NOT covered

Stated rather than papered over:

- **End-to-end tests against a live Supabase** are not runnable here — the
  sandbox has no credentials for a real project. The e2e specs exist but only run
  under a job that is not wired up, so they are currently decorative; the
  browser-driven `scripts/audit-*.mjs` suite above is the strongest signal that
  *does* run, which is why it is what this report quotes.
- **RLS policy tests** likewise need a live database. The policies relied on here
  (`analytics_owner_private`, `coach_own_all`) are asserted structurally from the
  schema mirror instead — see `analytics-snapshots-core.test.ts`, which fails if
  an INSERT policy ever appears.
- **Seed data for internships**: no row in `volunteer_opportunities` currently
  carries an internship category, so `/internships` renders its empty state. That
  state is the tested path; the populated path is covered by unit tests over the
  same pure helpers, not by a browser run.
