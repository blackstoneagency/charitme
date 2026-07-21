# Campaign Image Change Log

## 2026-07-20 — Per-campaign covers + distinct category covers + CI audit

**Reason:** Campaign imagery was assigned per-category, so every campaign in a
category shared one identical cover, and 5 categories shared covers with each
other. See `CAMPAIGN_IMAGE_AUDIT.md`.

**Covers reassigned to be globally distinct:**

| Category | Previous cover | New cover | Reason |
|---|---|---|---|
| Emergency | `1469571486292` (shared w/ Travel, Volunteer) | `1593113630400` (relief/aid) | de-duplicate + relevance |
| Travel | `1469571486292` (shared) | `1488646953014` (journey) | de-duplicate + relevance |
| Wishes | `1503454537195` (shared w/ Family) | `1533230408708` (sky lanterns/hope) | de-duplicate + relevance |
| Volunteer | `1469571486292` | `1469571486292` (kept — literally volunteers) | now unique after others moved |
| Family | `1503454537195` | `1503454537195` (kept — child/family) | now unique after Wishes moved |

**New verified images (all HTTP 200):** `1593113630400-ea4288922497`,
`1488646953014-85cb44e25828`, `1501785888041-af3ef285b470`,
`1533230408708-8f9f91d1235a`.

**Files changed:**
- `apps/web/lib/photo-catalog.ts` — distinct covers; added `getCoverForCampaign()`.
- `apps/web/components/CampaignImage.tsx` — optional `campaignKey` prop.
- `apps/web/app/campaigns/page.tsx`, `app/campaigns/[slug]/page.tsx`,
  `app/page.tsx`, `app/success-stories/page.tsx`, `app/donors/[id]/page.tsx`,
  `app/leaderboard/LeaderboardClient.tsx` — pass campaign slug to the selector.
- `apps/web/scripts/audit-campaign-images.mjs` + `package.json` — CI audit.
- `apps/web/__tests__/photo-catalog.test.ts` — 11 tests.
- `supabase/migrations/20260723000000_campaign_cover_per_campaign.sql` — DB
  distribution (protects user-uploaded covers).

**Validation:** `audit:campaign-images --live` 45/45 HTTP 200, covers distinct;
655 unit tests pass; `tsc --noEmit` clean; `next build` 132 pages.

**Database records changed:** the migration rewrites `cover_image_url` +
`image_urls` for campaigns with NULL/empty or seed-placeholder Unsplash covers.
It runs against a database; it was **not** executed against production from the
sandbox — apply it via your normal migration path.

**Not performed (needs staging/browser):** Supabase Storage upload of optimized
WebP/AVIF, perceptual-hash near-duplicate detection, per-image visual relevance
grading, responsive visual regression. Tracked in `todo.md`.

## 2026-07-21 — Audit extended to SQL migrations; 23 broken IDs fixed

**Reason:** `audit:campaign-images` only verified the TS catalog. The images
that actually land in the DB are also written by SQL migrations
(`campaign_photos*.sql` + the per-campaign distribution), which were unguarded.

**Change:** the audit now also collects every `images.unsplash.com` photo URL
from `supabase/migrations/*.sql` and includes them in the `--live` HTTP-200
verification (and approved-host check).

**Found + fixed:** the extended live audit flagged **23 of 68** SQL image IDs
returning **404** (removed upstream) — all in `20260608010000_campaign_photos.sql`
gallery arrays. Each was replaced with a verified-live catalog ID. These were
already superseded in production by `20260723000000_campaign_cover_per_campaign.sql`
(all-verified catalog IDs), so no user-facing impact — but the repo/seed is now
clean and the guard covers the DB layer going forward.

**Validation:** `npm run audit:campaign-images:live` → 45/45 IDs HTTP 200 across
catalog + migrations; 729 unit tests pass.
