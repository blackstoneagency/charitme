# Campaign Image Audit

> Generated 2026-07-20. **Honest about method:** it separates what was verified
> in code + by live HTTP checks from what requires a browser, live Supabase
> Storage, and binary image processing to complete. No fabricated hashes,
> screenshots, or "pass" marks.

## TL;DR

The platform did **not** have per-campaign images to begin with. Seed campaigns
are **procedurally generated** (250 in `seed_250.sql`, 120 in
`seeds/01_campaigns_core.sql`, 3 in `seed.sql`) with **no per-row image**. All
campaign imagery was assigned **by category** in `20260608010000_campaign_photos.sql`
(and its `_fix`), so **every campaign in a category shared one identical cover**,
and the gallery `image_urls` recycled a handful of core photos across many
categories. That category-blanket assignment — not broken URLs — was the real
"duplicate image" problem.

This pass fixes that at both layers (app render + database) and adds a CI guard
so duplicates/broken covers can't silently return.

## What was verified (evidence)

| Check | Tool | Result |
|-------|------|--------|
| Every catalog photo ID resolves HTTP 200 | `npm run audit:campaign-images:live` | **45/45 PASS** (0 broken) |
| Category covers are distinct across categories | audit static | **PASS** (was 2 collisions — fixed) |
| No pool repeats a photo within itself | audit static | PASS |
| All URLs use approved host + sizing params | audit static | PASS |
| Deterministic per-campaign spread | `__tests__/photo-catalog.test.ts` | **11/11 PASS** |
| Full suite / typecheck / build | vitest, tsc, next build | **655 tests, type-clean, 132 pages** |

### Findings the audit caught (now resolved)

- **THM/IMG-01 — shared covers.** `Emergency`, `Travel`, `Volunteer` all used the
  same "volunteers" cover; `Family` and `Wishes` shared the "child" cover. The
  audit's cross-category cover-uniqueness check failed on these. Fixed by sourcing
  3 new, HTTP-200-verified, category-relevant covers (Emergency → relief/aid,
  Travel → journey, Wishes → sky lanterns/hope) and reassigning so all 18 covers
  are distinct.
- **IMG-02 — one identical cover per category (within-category duplication).**
  Fixed with a deterministic per-campaign selector (below).

## The fix

### 1. App render layer — `apps/web/lib/photo-catalog.ts`
Added `getCoverForCampaign(category, key)`: a stable FNV-1a hash of a per-campaign
key (slug → id → title) indexes into the category's photo pool, so campaigns in
the same category are spread across the pool instead of all showing `pool[0]`.
Every consumer that previously did `cover_image_url || getCoverForCategory(cat)`
now passes the campaign's slug:

- `app/campaigns/page.tsx` (grid), `app/campaigns/[slug]/page.tsx` (hero, meta,
  similar), `app/page.tsx` (home hero + featured cards via `CampaignImage`),
  `app/success-stories/page.tsx`, `app/donors/[id]/page.tsx`,
  `app/leaderboard/LeaderboardClient.tsx`.
- `components/CampaignImage.tsx` gained an optional `campaignKey` prop so its
  broken-image fallback also varies per campaign.

This matters because most seeded campaigns have a **null** stored cover and fall
back to the catalog — previously identical, now varied.

### 2. Database layer — `supabase/migrations/20260723000000_campaign_cover_per_campaign.sql`
Distributes covers + galleries per-campaign across each category's verified pool,
keyed by `hashtext(slug)`. **Safety:** only rewrites covers that are NULL/empty or
a prior seed/placeholder `images.unsplash.com` URL — a real user-uploaded cover
(e.g. a Supabase Storage URL) is never overwritten. The pool is kept in sync with
`photo-catalog.ts`.

### 3. CI guard — `apps/web/scripts/audit-campaign-images.mjs`
`npm run audit:campaign-images` (static) / `:live` (adds HTTP-200 verification).
Exits non-zero on: category pool too small, cover shared across categories,
non-approved host, missing width/quality params, or (with `--live`) any non-200
image. Wire into CI to prevent regressions.

## Licensing

All images are from **Unsplash** under the [Unsplash License](https://unsplash.com/license)
(free for commercial and personal use, no attribution required). No images were
scraped from GoFundMe, social media, news, blogs, or search thumbnails. The
approved-host allowlist in the audit script enforces this. See
`CAMPAIGN_IMAGE_SOURCES.md`.

## Not done here — needs live infra / a browser (scoped, not skipped)

This sandbox has **no live Supabase Storage write access we should use against
production, no headless browser, and no binary image pipeline**, so the following
parts of the full brief are **explicitly out of scope for this pass** and must run
in a staging environment:

1. **Download → optimize (WebP/AVIF) → upload to Supabase Storage** and repoint
   records at stable storage paths (removing hotlink dependency). *We currently
   hotlink Unsplash CDN URLs — verified live, but still third-party.*
2. **Perceptual/difference/average hashing** of image binaries for near-duplicate
   (crop/mirror/recolor) detection. The current audit does **exact** ID-level dedup
   only — it does not download and phash binaries, so it cannot claim near-dup
   coverage. Not faked.
3. **Per-campaign visual relevance & quality grading** and **responsive
   visual-regression** (320–1920px, light/dark). Covers are matched by *category*
   intent; true per-image relevance needs a human/browser pass.
4. **Storage-bucket RLS/SSRF/MIME/traversal hardening** for a server-side image
   ingestion path (only relevant once #1 exists).

These are tracked in `todo.md` under the Campaign Image workstream.

## Documents

- `CAMPAIGN_IMAGE_AUDIT.md` — this file
- `CAMPAIGN_IMAGE_SOURCES.md` — image inventory + licensing
- `CAMPAIGN_IMAGE_CHANGELOG.md` — change log
- `apps/web/scripts/audit-campaign-images.mjs` — the CI audit
- `apps/web/lib/photo-catalog.ts` — the single source of truth for covers
