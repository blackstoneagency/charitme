/**
 * Key-free source of professional, public-domain campaign photos.
 *
 * Rawpixel via the Openverse API. Why this source specifically:
 *
 *   · **CC0** — a public-domain dedication. No attribution, no share-alike, no
 *     commercial restriction. That is a stronger "100% free" than the Unsplash
 *     License, which is free but not a PD dedication.
 *   · **Professional stock.** Rawpixel is a commercial stock library that
 *     releases a large CC0 collection; the photos measure 3-5 MP and are shot
 *     and edited as stock, not uploaded as snapshots.
 *   · **One host** — `images.rawpixel.com` — so the site CSP needs exactly one
 *     new entry rather than the scatter of hosts a general Openverse query
 *     returns.
 *   · **No API key.** Openverse search is open, which matters because Unsplash
 *     search is unreachable from CI and from the agent sandbox.
 *
 * ⚠️ QUERY SHAPE IS LOAD-BEARING, and this cost two wrong conclusions before it
 * was understood. Long multi-word queries collapse to almost nothing on this
 * index: `"family children parents home"` returns 0 while `"parents"` returns
 * 240. An early measurement using long queries reported "~179 photos available,
 * nine categories at zero" and led me to write off this whole source. Re-measured
 * with single-concept queries, 17 of 18 categories return the 240 result cap.
 * Keep the queries SHORT.
 */

const ENDPOINT = 'https://api.openverse.org/v1/images/';

/**
 * ⚠️ 20 is a HARD CEILING for anonymous callers, not a tuning choice. Openverse
 * answers `401 {"detail":"page_size may not exceed 20 for anonymous requests"}`
 * above it — and because the harvester treats a failed page as "move on", a
 * page_size of 100 silently produced an EMPTY pool for every category. The run
 * refused to assign rather than half-assign, which is the only reason it was
 * caught immediately instead of shipping duplicates.
 */
const PAGE_SIZE = 20;

/** 12 pages x 20 = 240, which is the result cap this index returns anyway. */
const MAX_PAGES = 12;

/**
 * ⚠️ Pacing is REQUIRED, not politeness. Openverse rate-limits bursts, and a
 * rejected page is skipped by design — so an unpaced harvest silently returns a
 * fraction of what exists. Measured on `church`: unpaced gave 32 usable photos
 * and could not fill a 73-campaign category; at 1200ms it returned **149 usable
 * from 240 results with zero failed pages**. The supply was never the problem.
 */
const REQUEST_DELAY_MS = 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Category → short, single-concept queries.
 *
 * Several per category so a pool can be filled from more than one angle without
 * lengthening any individual query (see the warning above). Ordered most to
 * least on-theme; the harvester drains them in order and stops once it has
 * enough, so the best-matching photos are the ones that get used.
 */
export const CATEGORY_QUERIES = {
  Medical: ['hospital', 'doctor', 'nurse', 'medicine', 'healthcare'],
  Education: ['classroom', 'student', 'school', 'books', 'library'],
  Faith: ['church', 'prayer', 'chapel', 'cathedral', 'worship'],
  Emergency: ['firefighter', 'ambulance', 'rescue', 'flood', 'disaster'],
  Community: ['community', 'neighborhood', 'people', 'together', 'crowd'],
  Creative: ['painting', 'art', 'music', 'studio', 'craft'],
  Sports: ['sport', 'football', 'running', 'basketball', 'athlete'],
  Environment: ['forest', 'nature', 'ocean', 'tree', 'mountain'],
  Volunteer: ['volunteer', 'helping', 'charity', 'teamwork', 'hands'],
  Nonprofit: ['donation', 'charity', 'giving', 'community', 'support'],
  Family: ['parents', 'children', 'baby', 'grandparents', 'home'],
  Memorial: ['flowers', 'candle', 'memorial', 'cemetery', 'remembrance'],
  Event: ['celebration', 'party', 'festival', 'concert', 'wedding'],
  Animal: ['dog', 'cat', 'puppy', 'horse', 'wildlife'],
  Competition: ['trophy', 'medal', 'winner', 'race', 'chess'],
  Travel: ['travel', 'journey', 'airplane', 'road', 'city'],
  Business: ['shop', 'market', 'bakery', 'office', 'workshop'],
  Wishes: ['gift', 'balloons', 'birthday', 'smile', 'sunrise'],
};

/** Every host this module can return. Must match the CSP and APPROVED_HOSTS. */
export const PHOTO_HOST = 'images.rawpixel.com';

/**
 * Is this result usable as a campaign cover?
 *
 * Landscape and reasonably large: covers render in a 4:3-ish card, and a tall
 * portrait crops to a face-height sliver. 1200px keeps it sharp on a 2x display.
 */
export function isUsable(result) {
  if (!result?.url || !result.width || !result.height) return false;
  if (result.license !== 'cc0' && result.license !== 'pdm') return false;
  if (result.width < 1200) return false;
  return result.width > result.height;
}

/**
 * Collect up to `need` distinct usable photos for a category.
 *
 * `fetchJson` is injected so the harvest can be unit-tested without a network.
 */
export async function harvestCategory(category, need, fetchJson, delayMs = REQUEST_DELAY_MS) {
  const queries = CATEGORY_QUERIES[category] ?? ['community'];
  const seen = new Set();
  const out = [];

  for (const q of queries) {
    for (let page = 1; page <= MAX_PAGES && out.length < need; page++) {
      const url = `${ENDPOINT}?q=${encodeURIComponent(q)}`
        + `&license=cc0,pdm&source=rawpixel&page_size=${PAGE_SIZE}&page=${page}`;
      let body;
      try {
        body = await fetchJson(url);
      } catch {
        break; // transient — move to the next query rather than abort the run
      }
      if (delayMs) await sleep(delayMs);
      const results = body?.results ?? [];
      if (results.length === 0) break;
      for (const r of results) {
        if (out.length >= need) break;
        if (!isUsable(r) || seen.has(r.url)) continue;
        seen.add(r.url);
        out.push({
          id: r.id,
          url: r.url,
          author: r.creator || 'Rawpixel',
          license: r.license,
          title: r.title || '',
          query: q,
        });
      }
    }
    if (out.length >= need) break;
  }
  return out;
}
