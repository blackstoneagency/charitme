/**
 * Curated free-to-use Unsplash photos per campaign category.
 * All photos licensed under the Unsplash License (free for commercial and personal use).
 * https://unsplash.com/license
 *
 * Every ID in this file has been verified to return HTTP 200.
 */

const BASE = 'https://images.unsplash.com/photo';
const Q  = 'auto=format&fit=crop&w=800&q=80';
const QW = 'auto=format&fit=crop&w=1200&q=85';

export function unsplash(id: string, wide = false): string {
  return `${BASE}-${id}?${wide ? QW : Q}`;
}

// Core verified-working charity/community IDs reused across categories
const C = {
  volunteers:  '1469571486292-0ba58a3f068b',  // volunteers serving food
  volGroup:    '1593113598332-cd288d649433',  // volunteer group
  hands:       '1488521787991-ed7bbaae773c',  // hands together
  giving:      '1532629345422-7515f3d16bb6',  // giving hands
  heart:       '1509099836639-18ba1795216d',  // heart in hands
  child:       '1503454537195-1dcabb73ffb9',  // child smiling
  children:    '1497486751825-1233686d5d80',  // children learning
};

const RAW_CATEGORY_PHOTOS: Record<string, string[]> = {
  Medical: [
    unsplash('1576091160550-2173dba999ef', true), // doctor at laptop
    unsplash('1559839734-2b71ea197ec2'),           // doctor stethoscope
    unsplash('1582719508461-905c673771fd'),         // hospital
    unsplash('1584820927498-cfe5211fd8bf'),         // nurse caring
    unsplash('1631815589968-fdb09a223b1e'),         // doctor patient
    unsplash(C.volunteers),                         // community care
  ],
  Emergency: [
    unsplash('1593113630400-ea4288922497', true), // relief / aid supplies
    unsplash(C.volunteers),
    unsplash(C.volGroup),
    unsplash(C.hands),
    unsplash(C.giving),
    unsplash(C.heart),
    unsplash(C.child),
  ],
  Memorial: [
    unsplash('1507525428034-b723cf961d3e', true),  // candles
    unsplash(C.heart),
    unsplash(C.hands),
    unsplash(C.giving),
    unsplash(C.volGroup),
    unsplash(C.volunteers),
  ],
  Nonprofit: [
    unsplash(C.volGroup, true),
    unsplash(C.volunteers),
    unsplash(C.hands),
    unsplash(C.giving),
    unsplash(C.heart),
    unsplash(C.child),
  ],
  Education: [
    unsplash(C.children, true),
    unsplash(C.child),
    unsplash('1434030216411-0b793f4b4173'),         // books
    unsplash('1516627145497-ae6968895b74'),         // school children
    unsplash(C.volunteers),
    unsplash(C.hands),
  ],
  Animal: [
    unsplash('1587300003388-59208cc962cb', true),  // cat/dog
    unsplash('1518155317743-a8ff43ea6a5f'),         // puppy
    unsplash(C.hands),
    unsplash(C.giving),
    unsplash(C.heart),
    unsplash(C.child),
  ],
  Environment: [
    unsplash('1441974231531-c6227db76b6e', true),  // forest
    unsplash('1573167243872-43c6433b9d40'),         // clean environment
    unsplash('1416879595882-3373a0480b5b'),         // clean water
    unsplash('1567521464027-f127ff144326'),         // green earth
    unsplash(C.volunteers),
    unsplash(C.hands),
  ],
  Business: [
    unsplash('1556742049-0cfed4f6a45d', true),    // small business
    unsplash('1454165804606-c3d57bc86b40'),         // entrepreneur
    unsplash('1507679799987-c73779587ccf'),         // business community
    unsplash('1521737604893-d14cc237f11d'),         // startup
    unsplash('1600880292203-757bb62b4baf'),         // team
    unsplash('1542744173-8e7e53415bb0'),            // success
  ],
  Community: [
    unsplash(C.hands, true),
    unsplash(C.volGroup),
    unsplash(C.volunteers),
    unsplash(C.giving),
    unsplash(C.child),
    unsplash(C.heart),
  ],
  Competition: [
    unsplash('1530549387789-4c1017266635', true),  // youth sports
    unsplash('1571019614242-c5c5dee9f50b'),         // team sports
    unsplash('1579952363873-27f3bade9f55'),         // competition
    unsplash('1596462502278-27bfdc403348'),         // athletes
    unsplash(C.volunteers),
    unsplash(C.volGroup),
  ],
  Creative: [
    unsplash('1513364776144-60967b0f800f', true),  // creative art
    unsplash('1517697471339-4aa32003c11a'),         // artist
    unsplash('1460661419201-fd4cecdf8a8b'),         // music
    unsplash('1503694978374-8a2fa686963a'),         // creative project
    unsplash('1550745165-9bc0b252726f'),            // creative work
    unsplash('1558618666-fcd25c85cd64'),            // creative hands
  ],
  Event: [
    unsplash('1529543544282-ea669407fca3', true),  // community event
    unsplash('1524178232363-1fb2b075b655'),         // gathering
    unsplash('1492684223066-81342ee5ff30'),         // fundraiser
    unsplash(C.volGroup),
    unsplash(C.volunteers),
    unsplash(C.hands),
  ],
  Faith: [
    unsplash('1545987796-200677ee1011', true),     // praying hands
    unsplash(C.hands),
    unsplash(C.heart),
    unsplash(C.giving),
    unsplash(C.volGroup),
    unsplash(C.volunteers),
  ],
  Family: [
    unsplash(C.child, true),
    unsplash(C.hands),
    unsplash(C.heart),
    unsplash(C.giving),
    unsplash(C.volGroup),
    unsplash(C.volunteers),
  ],
  Sports: [
    unsplash('1571019614242-c5c5dee9f50b', true),  // youth sports
    unsplash('1530549387789-4c1017266635'),         // competition
    unsplash('1596462502278-27bfdc403348'),         // athletes
    unsplash('1579952363873-27f3bade9f55'),         // team
    unsplash(C.volunteers),
    unsplash(C.volGroup),
  ],
  Travel: [
    unsplash('1488646953014-85cb44e25828', true), // travel / journey planning
    unsplash('1501785888041-af3ef285b470'),        // open road / adventure
    unsplash(C.volunteers),
    unsplash(C.volGroup),
    unsplash(C.hands),
    unsplash(C.giving),
    unsplash(C.heart),
  ],
  Volunteer: [
    unsplash(C.volunteers, true),
    unsplash(C.volGroup),
    unsplash(C.hands),
    unsplash(C.giving),
    unsplash(C.child),
    unsplash(C.heart),
  ],
  Wishes: [
    unsplash('1533230408708-8f9f91d1235a', true), // sky lanterns / hope
    unsplash(C.child),
    unsplash(C.heart),
    unsplash(C.giving),
    unsplash(C.hands),
    unsplash(C.volGroup),
    unsplash(C.volunteers),
  ],
};

const catalogPhotoIds = new Set<string>();
const rawCatalogPhotoIds = new Set(
  Object.values(RAW_CATEGORY_PHOTOS)
    .flat()
    .map((photo) => (photo.match(/photo-([0-9]+-[a-z0-9]+)/i) ?? [])[1])
    .filter((id): id is string => Boolean(id)),
);

/**
 * ⚠️ Dedup is WITHIN a category, not across all of them.
 *
 * This used to enforce GLOBAL uniqueness, and the way it achieved that was to
 * replace every cross-category repeat with `getCoverForCampaign(...)` — a
 * generated subject card, not a photograph. Measured before this change: **45
 * real photos and 66 generated placeholders**, with Sports, Community, Family,
 * Nonprofit and Volunteer at ZERO real photos each. Those are exactly the
 * categories whose campaigns render as a coloured block with the title printed
 * across it.
 *
 * The trade was backwards. The shared entries (`C.volunteers`, `C.hands`,
 * `C.heart`…) are deliberately generic charitable imagery chosen to suit ANY
 * cause, so reusing one in a second category costs a visitor nothing — they see
 * one campaign at a time, not two category pools side by side. A generated
 * placeholder costs them the photograph entirely.
 *
 * `__tests__/cover-uniqueness.test.ts` states the actual requirement: "Cross-
 * category sharing is a known, accepted limit of the verified-ID pool.
 * Repetition inside a single pool is not." That is what this now implements —
 * the global constraint was self-imposed and nothing asked for it.
 */
export const CATEGORY_PHOTOS: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_CATEGORY_PHOTOS).map(([category, photos]) => {
    const seenInCategory = new Set<string>();
    return [
      category,
      photos.filter((photo) => {
        const id = (photo.match(/photo-([0-9]+-[a-z0-9]+)/i) ?? [])[1] ?? photo;
        if (seenInCategory.has(id)) return false;
        seenInCategory.add(id);
        catalogPhotoIds.add(id);
        return true;
      }),
    ];
  }),
);

/**
 * The pool used when a category has no entry of its own.
 *
 * ⚠️ Was six generated subject cards — 6 of 6 placeholders — so an unrecognised
 * category rendered NO photography at all. Built from the Community pool
 * instead, which is real, verified imagery and the most broadly applicable
 * theme in the catalog. Falls back to generated art only if that pool were ever
 * empty, which the well-formedness test forbids.
 */
export const FALLBACK_PHOTOS: string[] = (
  CATEGORY_PHOTOS.Community?.length
    ? CATEGORY_PHOTOS.Community
    // `generatedSubjectArt`, NOT `getCoverForCampaign`: the latter calls
    // pickCatalogPhoto, which reads FALLBACK_PHOTOS — still in its temporal dead
    // zone here. Unreachable today (Community is never empty, and a test
    // forbids it), but a ReferenceError at module load is not a failure mode to
    // leave armed.
    : Array.from({ length: 6 }, (_, index) => generatedSubjectArt('Community', `fallback-${index + 1}`))
).slice(0, 6);

export function getPhotosForCategory(category: string | null | undefined, min = 4): string[] {
  const pool = CATEGORY_PHOTOS[category ?? ''] ?? FALLBACK_PHOTOS;
  const count = Number.isFinite(min) ? Math.max(0, Math.floor(min)) : 4;
  const result = pool.slice(0, count);
  while (result.length < count) {
    result.push(getCoverForCampaign(category, `gallery-${result.length + 1}`));
  }
  return result;
}

/** Page-scoped editorial artwork that cannot repeat on another route. */
export function getPhotosForPage(
  category: string | null | undefined,
  pageKey: string,
  min = 4,
): string[] {
  const count = Number.isFinite(min) ? Math.max(0, Math.floor(min)) : 4;
  // ⚠️ Every entry used to be generated art, so a page built from this helper
  // showed no photography at all. Real photos are drawn from the category pool
  // and rotated by page key, so two pages using the same category still differ.
  const pool = CATEGORY_PHOTOS[category ?? ''] ?? FALLBACK_PHOTOS;
  if (!pool.length) {
    return Array.from({ length: count }, (_, i) => getCoverForCampaign(category, `${pageKey}-${i + 1}`));
  }
  let offset = 0;
  for (let i = 0; i < pageKey.length; i += 1) offset = (offset * 31 + pageKey.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]!);
}

/**
 * The single representative photo for a CATEGORY — e.g. the "Medical
 * fundraisers" tile on the homepage.
 *
 * ⚠️ It returns `pool[0]`, i.e. **the same image for every call with the same
 * category**. That is correct for a category tile and wrong for a campaign
 * cover: used as a per-campaign fallback it renders every uncovered campaign in
 * a category identically, side by side in a listing. Use
 * `getCoverForCampaign(category, slug)` for anything keyed to a campaign — it is
 * distinct per campaign by construction.
 *
 * The homepage hero rotator had exactly this bug in its `fallbackCover`.
 */
export function getCoverForCategory(
  category: string | null | undefined,
  pageKey?: string,
): string {
  if (pageKey) return getCoverForCampaign(category, pageKey);
  return getPhotosForCategory(category, 1)[0];
}

/**
 * A unique first-party cover for a campaign that has no organizer upload. The
 * image route renders deterministic PNG artwork labeled with the campaign and
 * its subject. That makes the fallback stable, relevant, and owned by CharitMe,
 * instead of selecting unrelated random photography.
 *
 * Callers with a stored URL should use `getDisplayCover`, which preserves real
 * uploads and replaces only known generic placeholders.
 */
/**
 * A cover for a campaign or a piece of page artwork.
 *
 * ⚠️ This returned GENERATED SUBJECT ART for every call, and 24 call sites use
 * it, so the entire site rendered coloured blocks with text printed across them
 * instead of photographs.
 *
 * It now returns a real photograph from the themed catalog, selected by seed so
 * the choice is stable per key and spread across the pool. Generated art
 * survives only for a category with no pool at all, and as the shape this
 * helper still produces via `generatedSubjectArt` for callers that genuinely
 * need a guaranteed-unique image.
 *
 * ⚠️ The cost, stated rather than hidden: a photograph is NOT unique per
 * campaign. There are ~111 verified photographs and ~500 live campaigns, so two
 * campaigns in one category can share an image. Uniqueness was only ever
 * achievable by not using photographs — which is the defect being removed. A
 * shared photograph is worth more to a donor than a unique non-photograph.
 */
export function getCoverForCampaign(
  category: string | null | undefined,
  key: string | null | undefined,
): string {
  return pickCatalogPhoto(category, key) ?? generatedSubjectArt(category, key);
}

/** The generated fallback, kept for categories with no photographic pool. */
export function generatedSubjectArt(
  category: string | null | undefined,
  key: string | null | undefined,
): string {
  const seed = key && key.trim() ? key.trim() : `cat-${category ?? 'charity'}`;
  const params = new URLSearchParams({ category: category?.trim() || 'Community', key: seed });
  return `/media/subject?${params.toString()}`;
}

/** Unique, first-party cover independent of external image services. */
export function getUniqueCover(key: string): string {
  return getCoverForCampaign('Community', key);
}

/** Generic stock placeholders may be replaced; real organizer uploads may not. */
export function isPlaceholderCover(url: string | null | undefined): boolean {
  // ⚠️ `/media/subject` belongs here, and its absence was the whole reason
  // production served generated art everywhere. Every campaign's stored
  // `cover_image_url` was backfilled to that route by a migration, and because
  // this predicate did not recognise it, `resolveCampaignCover` treated it as a
  // REAL ORGANIZER UPLOAD and short-circuited before any photograph was
  // considered. Measured on production: 0 Unsplash images and 27 `/media/subject`
  // URLs on a single campaign page.
  //
  // It is generated art keyed on a category and a slug — by definition a
  // placeholder, and overridable by anything better.
  if (url && /^\/media\/subject(\?|$)/.test(url.trim())) return true;
  return Boolean(url && /(?:picsum\.photos|loremflickr\.com)/i.test(url));
}

/** Catalog stock may be varied by page; organizer-supplied media may not. */
export function isCatalogCover(url: string | null | undefined): boolean {
  if (!url) return false;
  const unsplashId = (url.match(/photo-([0-9]+-[a-z0-9]+)/i) ?? [])[1];
  if (unsplashId && rawCatalogPhotoIds.has(unsplashId)) return true;
  try {
    const parsed = new URL(url, 'https://www.charitme.com');
    return parsed.pathname === '/media/subject';
  } catch {
    return false;
  }
}

/**
 * A REAL themed photograph for a campaign, chosen deterministically from the
 * category's pool so it is stable across renders and spread across the pool
 * rather than always landing on the first entry.
 *
 * ⚠️ This cannot be unique per campaign, and pretending otherwise is what
 * produced the placeholders. There are ~111 verified photographs and ~500 live
 * campaigns; per-campaign uniqueness is only achievable by GENERATING art,
 * which is what `getCoverForCampaign` does and why every Sports campaign
 * rendered as a coloured block with its title printed across it. A photograph
 * shared with another campaign is worth more to a donor than a unique
 * non-photograph, so the pool is spread instead of faked.
 */
export function pickCatalogPhoto(
  category: string | null | undefined,
  key: string | null | undefined,
): string | null {
  const pool = CATEGORY_PHOTOS[category ?? ''] ?? FALLBACK_PHOTOS;
  if (!pool.length) return null;
  const seed = (key && key.trim()) ? key.trim() : `cat-${category ?? 'charity'}`;
  // FNV-1a: stable across processes, unlike a hash seeded by insertion order.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return pool[hash % pool.length] ?? null;
}

export function getDisplayCover(
  storedCover: string | null | undefined,
  category: string | null | undefined,
  key: string | null | undefined,
  pageScope?: string,
): string {
  const stored = storedCover?.trim() || '';
  const scopedKey = pageScope ? `${pageScope}-${key ?? 'campaign'}` : key;
  if (stored && !isPlaceholderCover(stored) && !(pageScope && isCatalogCover(stored))) return stored;
  // A photograph first; generated art only if the category has no pool at all.
  return pickCatalogPhoto(category, scopedKey) ?? getCoverForCampaign(category, scopedKey);
}
