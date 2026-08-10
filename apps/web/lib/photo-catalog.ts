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

export const CATEGORY_PHOTOS: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_CATEGORY_PHOTOS).map(([category, photos]) => [
    category,
    photos.map((photo, index) => {
      const id = (photo.match(/photo-([0-9]+-[a-z0-9]+)/i) ?? [])[1] ?? photo;
      if (!catalogPhotoIds.has(id)) {
        catalogPhotoIds.add(id);
        return photo;
      }
      return getCoverForCampaign(category, `catalog-${index + 1}`);
    }),
  ]),
);

export const FALLBACK_PHOTOS: string[] = Array.from(
  { length: 6 },
  (_, index) => getCoverForCampaign('Community', `fallback-${index + 1}`),
);

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
  return Array.from(
    { length: count },
    (_, index) => getCoverForCampaign(category, `${pageKey}-${index + 1}`),
  );
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
export function getCoverForCampaign(
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

export function getDisplayCover(
  storedCover: string | null | undefined,
  category: string | null | undefined,
  key: string | null | undefined,
  pageScope?: string,
): string {
  const stored = storedCover?.trim() || '';
  const scopedKey = pageScope ? `${pageScope}-${key ?? 'campaign'}` : key;
  return stored && !isPlaceholderCover(stored) && !(pageScope && isCatalogCover(stored))
    ? stored
    : getCoverForCampaign(category, scopedKey);
}
