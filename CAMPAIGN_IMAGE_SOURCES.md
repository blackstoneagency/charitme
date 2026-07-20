# Campaign Image Sources

All campaign imagery is sourced from **Unsplash** under the
[Unsplash License](https://unsplash.com/license): free for commercial and
personal use, no attribution required. No images are scraped from GoFundMe,
social media, news publishers, blogs, competitor sites, or search-result
thumbnails. The audit script (`apps/web/scripts/audit-campaign-images.mjs`)
enforces the approved host allowlist (`images.unsplash.com`).

- **Provider:** Unsplash (`images.unsplash.com` CDN)
- **License:** Unsplash License — https://unsplash.com/license
- **Attribution required:** No
- **Retrieved / verified:** 2026-07-20 — every ID below returned HTTP 200 via
  `npm run audit:campaign-images:live`
- **Source of truth:** `apps/web/lib/photo-catalog.ts`
- **Canonical page for any photo:** `https://unsplash.com/photos/<id>` (the
  numeric-suffixed ID; the CDN URL is the delivery form, the photo page is the
  licensing record)

## Category covers (all distinct)

| Category | Cover photo ID | Pool size |
|---|---|---|
| Medical | `1576091160550-2173dba999ef` | 6 |
| Emergency | `1593113630400-ea4288922497` | 7 |
| Memorial | `1507525428034-b723cf961d3e` | 6 |
| Nonprofit | `1593113598332-cd288d649433` | 6 |
| Education | `1497486751825-1233686d5d80` | 6 |
| Animal | `1587300003388-59208cc962cb` | 6 |
| Environment | `1441974231531-c6227db76b6e` | 6 |
| Business | `1556742049-0cfed4f6a45d` | 6 |
| Community | `1488521787991-ed7bbaae773c` | 6 |
| Competition | `1530549387789-4c1017266635` | 6 |
| Creative | `1513364776144-60967b0f800f` | 6 |
| Event | `1529543544282-ea669407fca3` | 6 |
| Faith | `1545987796-200677ee1011` | 6 |
| Family | `1503454537195-1dcabb73ffb9` | 6 |
| Sports | `1571019614242-c5c5dee9f50b` | 6 |
| Travel | `1488646953014-85cb44e25828` | 7 |
| Volunteer | `1469571486292-0ba58a3f068b` | 6 |
| Wishes | `1533230408708-8f9f91d1235a` | 7 |

Total: **18 categories · 45 distinct verified photo IDs** (pools intentionally
share some general charity/community photos in non-cover slots; covers are unique).

## Images added in this pass (2026-07-20)

| ID | Intended subject | For | HTTP |
|---|---|---|---|
| `1593113630400-ea4288922497` | relief / aid supplies | Emergency cover | 200 |
| `1488646953014-85cb44e25828` | travel / journey planning | Travel cover | 200 |
| `1501785888041-af3ef285b470` | open road / adventure | Travel gallery | 200 |
| `1533230408708-8f9f91d1235a` | sky lanterns / hope | Wishes cover | 200 |

> Note: subjects are the *intended* match by category. Per-image visual relevance
> and quality grading requires a browser render pass (see `CAMPAIGN_IMAGE_AUDIT.md`
> → "Not done here").
