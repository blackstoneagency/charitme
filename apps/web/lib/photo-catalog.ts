/**
 * Curated free-to-use Unsplash photos per campaign category.
 * All photos are licensed under the Unsplash License
 * (free for commercial and personal use, no attribution required).
 * https://unsplash.com/license
 *
 * URL format: https://images.unsplash.com/photo-{ID}?auto=format&fit=crop&w=800&q=80
 */

const BASE = 'https://images.unsplash.com/photo';
const Q = 'auto=format&fit=crop&w=800&q=80';
const QW = 'auto=format&fit=crop&w=1200&q=85'; // wide/cover variant

export function unsplash(id: string, wide = false): string {
  return `${BASE}-${id}?${wide ? QW : Q}`;
}

// ── Per-category photo sets (6 photos each, all charity-themed) ──────────────
// Each array: [cover (wide), photo2, photo3, photo4, photo5, photo6]

export const CATEGORY_PHOTOS: Record<string, string[]> = {
  Medical: [
    unsplash('1576091160550-2173dba999ef', true),  // medical team
    unsplash('1559839734-2b71ea197ec2'),             // doctor stethoscope
    unsplash('1582719508461-905c673771fd'),           // hospital corridor
    unsplash('1584820927498-cfe5211fd8bf'),           // nurse caring
    unsplash('1631815589968-fdb09a223b1e'),           // doctor with patient
    unsplash('1504813184591-a058ada88eca'),           // hospital flowers
  ],
  Emergency: [
    unsplash('1588776814546-1ffbb172ef8c', true),   // relief effort
    unsplash('1469571486292-0ba58a3f068b'),           // volunteers serving
    unsplash('1593113598332-cd288d649433'),           // volunteer team
    unsplash('1488521787991-ed7bbaae773c'),           // helping hands
    unsplash('1532629345422-7515f3d16bb6'),           // giving hands
    unsplash('1509099836639-18ba1795216d'),           // heart in hands
  ],
  Memorial: [
    unsplash('1507525428034-b723cf961d3e', true),   // candles memorial
    unsplash('1487700160041-9253caa4b8de'),           // memorial flowers
    unsplash('1541804060688-9d8a5f44c0b8'),           // community together
    unsplash('1488521787991-ed7bbaae773c'),           // hands together
    unsplash('1509099836639-18ba1795216d'),           // heart in hands
    unsplash('1532629345422-7515f3d16bb6'),           // giving hands
  ],
  Nonprofit: [
    unsplash('1593113598332-cd288d649433', true),   // volunteers vests
    unsplash('1469571486292-0ba58a3f068b'),           // volunteers serving food
    unsplash('1488521787991-ed7bbaae773c'),           // community hands
    unsplash('1532629345422-7515f3d16bb6'),           // giving hands
    unsplash('1509099836639-18ba1795216d'),           // heart in hands
    unsplash('1607748851687-ba9a45146cd4'),           // nonprofit team
  ],
  Education: [
    unsplash('1497486751825-1233686d5d80', true),   // children learning
    unsplash('1503454537195-1dcabb73ffb9'),           // child smiling
    unsplash('1488190211105-8fb0d4d54f0b'),           // classroom
    unsplash('1434030216411-0b793f4b4173'),           // books learning
    unsplash('1513258496099-ee67191f698a'),           // education
    unsplash('1516627145497-ae6968895b74'),           // school children
  ],
  Animal: [
    unsplash('1450778869180-b6cd2c73b7e4', true),   // rescue dog
    unsplash('1587300003388-59208cc962cb'),           // cat rescue
    unsplash('1518155317743-a8ff43ea6a5f'),           // puppy
    unsplash('1548199973-ec2cb9df83fd'),              // dog and child
    unsplash('1561037393-60df89cbff99'),              // animal shelter
    unsplash('1587300003388-59208cc962cb'),           // cats together
  ],
  Environment: [
    unsplash('1441974231531-c6227db76b6e', true),   // green forest
    unsplash('1500534314209-a157a0f250c5'),           // tree planting
    unsplash('1573167243872-43c6433b9d40'),           // clean environment
    unsplash('1521335629791-ee9686c6bcb6'),           // cleanup volunteers
    unsplash('1416879595882-3373a0480b5b'),           // clean water
    unsplash('1567521464027-f127ff144326'),           // green earth
  ],
  Business: [
    unsplash('1556742049-0cfed4f6a45d', true),      // small business
    unsplash('1454165804606-c3d57bc86b40'),           // entrepreneur support
    unsplash('1507679799987-c73779587ccf'),           // business community
    unsplash('1521737604893-d14cc237f11d'),           // startup
    unsplash('1600880292203-757bb62b4baf'),           // team business
    unsplash('1542744173-8e7e53415bb0'),              // business success
  ],
  Community: [
    unsplash('1488521787991-ed7bbaae773c', true),   // community hands
    unsplash('1593113598332-cd288d649433'),           // volunteers
    unsplash('1469571486292-0ba58a3f068b'),           // serving community
    unsplash('1532629345422-7515f3d16bb6'),           // giving
    unsplash('1607748851687-ba9a45146cd4'),           // community group
    unsplash('1509099836639-18ba1795216d'),           // heart in hands
  ],
  Competition: [
    unsplash('1530549387789-4c1017266635', true),   // youth sports competition
    unsplash('1571019614242-c5c5dee9f50b'),           // team sports
    unsplash('1579952363873-27f3bade9f55'),           // competition
    unsplash('1596462502278-27bfdc403348'),           // athletes
    unsplash('1543326727-cf6c39bbae7c'),              // competition team
    unsplash('1560272564-d940dfc96483'),              // sports event
  ],
  Creative: [
    unsplash('1513364776144-60967b0f800f', true),   // creative art
    unsplash('1517697471339-4aa32003c11a'),           // artist creating
    unsplash('1460661419201-fd4cecdf8a8b'),           // music creative
    unsplash('1503694978374-8a2fa686963a'),           // creative project
    unsplash('1550745165-9bc0b252726f'),              // creative work
    unsplash('1558618666-fcd25c85cd64'),              // creative hands
  ],
  Event: [
    unsplash('1540575467537-65e2f10b68fc', true),   // charity event
    unsplash('1529543544282-ea669407fca3'),           // community event
    unsplash('1524178232363-1fb2b075b655'),           // event gathering
    unsplash('1511632765153-9b08cf6f0f1a'),           // celebration event
    unsplash('1501281668745-f7f57925be31'),           // event crowd
    unsplash('1492684223066-81342ee5ff30'),           // fundraiser event
  ],
  Faith: [
    unsplash('1545987796-200677ee1011', true),       // praying hands
    unsplash('1541804060688-9d8a5f44c0b8'),           // faith community
    unsplash('1577083288073-40da2c536a75'),           // spiritual community
    unsplash('1488521787991-ed7bbaae773c'),           // hands together
    unsplash('1507679799987-c73779587ccf'),           // community
    unsplash('1509099836639-18ba1795216d'),           // heart
  ],
  Family: [
    unsplash('1511895426328-dc8714191011', true),   // family support
    unsplash('1531983372617-9b612d2110c4'),           // family together
    unsplash('1503454537195-1dcabb73ffb9'),           // child and parent
    unsplash('1476703993599-0035dd2b1397'),           // family love
    unsplash('1609220361534-ebbe05e08d04'),           // family hug
    unsplash('1609220361534-ebbe05e08d04'),           // family warmth
  ],
  Sports: [
    unsplash('1571019614242-c5c5dee9f50b', true),   // youth sports
    unsplash('1530549387789-4c1017266635'),           // sports competition
    unsplash('1596462502278-27bfdc403348'),           // team sport
    unsplash('1579952363873-27f3bade9f55'),           // athletes
    unsplash('1543326727-cf6c39bbae7c'),              // sports team
    unsplash('1560272564-d940dfc96483'),              // sports event
  ],
  Travel: [
    unsplash('1488085061851-1e7cf5c3b1e2', true),   // travel mission
    unsplash('1469571486292-0ba58a3f068b'),           // mission trip serving
    unsplash('1593113598332-cd288d649433'),           // volunteer travel
    unsplash('1488521787991-ed7bbaae773c'),           // global hands
    unsplash('1532629345422-7515f3d16bb6'),           // giving globally
    unsplash('1509099836639-18ba1795216d'),           // international help
  ],
  Volunteer: [
    unsplash('1469571486292-0ba58a3f068b', true),   // volunteers serving food
    unsplash('1593113598332-cd288d649433'),           // volunteer team vests
    unsplash('1488521787991-ed7bbaae773c'),           // volunteer hands
    unsplash('1532629345422-7515f3d16bb6'),           // giving
    unsplash('1607748851687-ba9a45146cd4'),           // volunteer group
    unsplash('1509099836639-18ba1795216d'),           // heart service
  ],
  Wishes: [
    unsplash('1503454537195-1dcabb73ffb9', true),   // child smile wish
    unsplash('1511895426328-dc8714191011'),           // family joy
    unsplash('1509099836639-18ba1795216d'),           // heart in hands
    unsplash('1532629345422-7515f3d16bb6'),           // giving
    unsplash('1488521787991-ed7bbaae773c'),           // community love
    unsplash('1607748851687-ba9a45146cd4'),           // celebration
  ],
};

// Fallback photos used when category has no match
export const FALLBACK_PHOTOS: string[] = [
  unsplash('1509099836639-18ba1795216d', true),
  unsplash('1488521787991-ed7bbaae773c'),
  unsplash('1532629345422-7515f3d16bb6'),
  unsplash('1593113598332-cd288d649433'),
  unsplash('1469571486292-0ba58a3f068b'),
  unsplash('1607748851687-ba9a45146cd4'),
];

/**
 * Returns at least `min` photos for a campaign category.
 * First photo is optimised for hero/cover (wide crop).
 * Always returns a complete set even if category is unknown.
 */
export function getPhotosForCategory(category: string | null | undefined, min = 4): string[] {
  const pool = CATEGORY_PHOTOS[category ?? ''] ?? FALLBACK_PHOTOS;
  // If pool is smaller than min, repeat from beginning
  const result: string[] = [];
  while (result.length < min) {
    result.push(...pool.slice(0, min - result.length));
  }
  return result;
}

/** Returns just the cover/hero photo for a category */
export function getCoverForCategory(category: string | null | undefined): string {
  return getPhotosForCategory(category, 1)[0];
}
