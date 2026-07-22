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

export const CATEGORY_PHOTOS: Record<string, string[]> = {
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

export const FALLBACK_PHOTOS: string[] = [
  unsplash(C.heart, true),
  unsplash(C.hands),
  unsplash(C.giving),
  unsplash(C.volGroup),
  unsplash(C.volunteers),
  unsplash(C.child),
];

export function getPhotosForCategory(category: string | null | undefined, min = 4): string[] {
  const pool = CATEGORY_PHOTOS[category ?? ''] ?? FALLBACK_PHOTOS;
  const result: string[] = [];
  while (result.length < min) {
    result.push(...pool.slice(0, min - result.length));
  }
  return result;
}

export function getCoverForCategory(category: string | null | undefined): string {
  return getPhotosForCategory(category, 1)[0];
}

/**
 * Stable, non-cryptographic string hash (FNV-1a). Used only to spread campaigns
 * deterministically across a category's photo pool — same input always yields
 * the same photo, so a campaign's cover never changes between renders/deploys.
 */
function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A stable, theme-matched cover for a campaign. Each campaign is spread across
 * the verified category pool by its stable id/slug, so covers remain reliable
 * and deterministic between renders/deploys.
 *
 * Callers should still prefer a real stored cover when present:
 *   campaign.cover_image_url || getCoverForCampaign(campaign.category, campaign.slug)
 */
export function getCoverForCampaign(
  category: string | null | undefined,
  key: string | null | undefined,
): string {
  const pool = CATEGORY_PHOTOS[category ?? ''] ?? FALLBACK_PHOTOS;
  if (!key) return pool[0];
  return pool[hashKey(key) % pool.length];
}

/** Unique, professional, reliable cover independent of theme (used as a safe last-resort). */
export function getUniqueCover(key: string): string {
  return `https://picsum.photos/seed/cm-${encodeURIComponent(key)}/800/450`;
}
