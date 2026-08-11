import { describe, it, expect } from 'vitest';
import {
  CATEGORY_PHOTOS,
  generatedSubjectArt,
  FALLBACK_PHOTOS,
  getCoverForCategory,
  getCoverForCampaign,
  getDisplayCover,
  getDistinctPhotosForItems,
  getPhotosForCategory,
  getPhotosForPage,
  isCatalogCover,
} from '../lib/photo-catalog';

const idOf = (url: string) => (url.match(/photo-([0-9]+-[a-z0-9]+)/) || [])[1] ?? url;
const categories = Object.keys(CATEGORY_PHOTOS);

describe('photo-catalog structure', () => {
  it('has categories, each with a non-trivial pool', () => {
    expect(categories.length).toBeGreaterThanOrEqual(10);
    for (const [cat, pool] of Object.entries(CATEGORY_PHOTOS)) {
      expect(pool.length, `${cat} pool size`).toBeGreaterThanOrEqual(4);
    }
    expect(FALLBACK_PHOTOS.length).toBeGreaterThanOrEqual(4);
  });

  it('every URL is licensed Unsplash photography or first-party subject artwork', () => {
    const all = [...Object.values(CATEGORY_PHOTOS).flat(), ...FALLBACK_PHOTOS];
    for (const url of all) {
      if (url.startsWith('https://images.unsplash.com/photo-')) {
        expect(url).toMatch(/[?&]w=\d+/);
        expect(url).toMatch(/[?&]q=\d+/);
      } else {
        expect(url).toMatch(/^\/media\/subject\?category=[^&]+&key=[^&]+$/);
      }
    }
  });

  // ⚠️ REPLACED: this used to assert global uniqueness across every pool —
  // `new Set(all.map(idOf)).size === all.length`.
  //
  // The rule was satisfied by DEFEATING ITS OWN PURPOSE. The only mechanism that
  // could satisfy it was substituting a generated subject card for every
  // cross-category repeat, so "every image is a unique photograph" was enforced
  // into "45 photographs and 66 things that are not photographs". Sports,
  // Community, Family, Nonprofit and Volunteer ended up with ZERO real photos —
  // which is why their campaigns rendered as a coloured block with the title
  // printed across it.
  //
  // Satisfying it honestly needs ~66 more verified Unsplash IDs assigned to the
  // right categories. Egress to images.unsplash.com now works, so IDs CAN be
  // verified as resolving (200 vs 404) — but nothing reachable from here reveals
  // what a photo DEPICTS. Assigning subject-unknown photos to named categories
  // risks a wedding photo on a medical campaign, which is worse than reusing a
  // known-correct charitable one.
  //
  // So the two properties that actually matter visually are asserted instead,
  // and they are both below: no repeat WITHIN a pool, and a distinct lead photo
  // per category. `__tests__/cover-uniqueness.test.ts` already stated this is the
  // real rule — "Cross-category sharing is a known, accepted limit of the
  // verified-ID pool. Repetition inside a single pool is not." The two files
  // disagreed; this one was wrong.
  it('contains NO generated placeholders — every catalog entry is a photograph', () => {
    // Stronger than the rule it replaces, in the direction that matters: the old
    // assertion permitted 66 non-photographs as long as they were distinct.
    const all = [...Object.values(CATEGORY_PHOTOS).flat(), ...FALLBACK_PHOTOS];
    const generated = all.filter((url) => url.includes('/media/subject'));
    expect(generated, `${generated.length} catalog entries are generated art, not photos`)
      .toEqual([]);
  });

  it('gives every category real photography', () => {
    for (const [category, pool] of Object.entries(CATEGORY_PHOTOS)) {
      const photos = pool.filter((u) => u.startsWith('https://images.unsplash.com/photo-'));
      expect(photos.length, `${category} has no real photography`).toBeGreaterThan(0);
    }
  });

  it('category cover photos are distinct across categories', () => {
    const covers = categories.map((c) => idOf(CATEGORY_PHOTOS[c][0]));
    expect(new Set(covers).size).toBe(covers.length);
  });

  it('no category pool repeats a photo within itself', () => {
    for (const [cat, pool] of Object.entries(CATEGORY_PHOTOS)) {
      const ids = pool.map(idOf);
      expect(new Set(ids).size, `${cat} has an internal duplicate`).toBe(ids.length);
    }
  });
});

describe('getCoverForCampaign — unique per-campaign cover', () => {
  // Covers are per-campaign-unique first-party subject images keyed on the stable
  // campaign slug/id. Distinct keys produce distinct labelled images.
  it('is deterministic: same key always yields the same cover', () => {
    const a = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    const b = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    expect(a).toBe(b);
  });

  it('returns a real PHOTOGRAPH for the campaign key', () => {
    // ⚠️ Was pinned to '/media/subject?category=Medical&key=help-sarah' —
    // generated art. 24 call sites use this helper, so that single return value
    // is why the whole site rendered coloured blocks with titles printed across
    // them. It now resolves to the themed catalog.
    expect(getCoverForCampaign('Medical', 'help-sarah')).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it('is deterministic — the same key always picks the same photo', () => {
    // The property that actually matters and is fully preserved: a card must not
    // flicker between images across renders.
    expect(getCoverForCampaign('Medical', 'help-sarah'))
      .toBe(getCoverForCampaign('Medical', 'help-sarah'));
  });

  it('spreads 200 campaigns across the whole pool rather than clumping', () => {
    // ⚠️ Was `expect(picks.size).toBe(200)` — one unique image per campaign.
    // That is UNACHIEVABLE with photographs: ~111 verified photos against ~500
    // live campaigns. It was only ever satisfiable by generating art, which is
    // the defect being removed. Two campaigns in a category CAN now share an
    // image, and that is an accepted, stated cost.
    //
    // What is still worth guarding is that selection uses the whole pool — a
    // hash that clumped onto one entry would put the same photo on every card
    // in a listing, which looks broken.
    const picks = new Set<string>();
    for (let i = 0; i < 200; i++) picks.add(getCoverForCampaign('Medical', `medical-campaign-${i}`));
    // The whole Medical pool is reached, and nothing clumps onto one image.
    expect(picks.size).toBe(CATEGORY_PHOTOS.Medical.length);
    expect(picks.size).toBeGreaterThan(1);
  });

  it('handles odd slugs without producing a malformed URL', () => {
    // ⚠️ Was asserting the ENCODED GENERATED URL. Encoding still matters for the
    // generated fallback, so it is asserted there directly; the campaign helper
    // now returns a catalog photo, whose URL does not embed the key at all —
    // which is precisely why odd slugs can no longer corrupt it.
    expect(getCoverForCampaign('Medical', 'a b/c')).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    expect(generatedSubjectArt('Medical', 'a b/c')).toBe('/media/subject?category=Medical&key=a+b%2Fc');
  });

  it('falls back to a stable category-based seed when no key is provided', () => {
    const a = getCoverForCampaign('Medical', null);
    const b = getCoverForCampaign('Medical', '');
    expect(a, 'null and empty must agree, or a card flickers').toBe(b);
    expect(a).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    // An unknown category still resolves to a photograph via FALLBACK_PHOTOS.
    expect(getCoverForCampaign(null, null)).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    // The seed shape itself is unchanged, checked on the generated fallback.
    expect(generatedSubjectArt('Medical', null)).toBe('/media/subject?category=Medical&key=cat-Medical');
  });

  it('replaces generic stock placeholders with a PHOTO, and preserves uploads', () => {
    // ⚠️ Was asserted as `/media/subject?category=Education&key=books` —
    // generated art. A placeholder is now replaced by real photography from the
    // themed catalog, which is the point of the change; generated art remains
    // only for a category with no pool.
    const replaced = getDisplayCover('https://picsum.photos/id/7/800/600', 'Education', 'books');
    expect(replaced).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);

    // Generated art stored on the row is a placeholder too, and this is the case
    // that made every campaign in production render a coloured block.
    const fromGenerated = getDisplayCover('/media/subject?category=Education&key=books', 'Education', 'books');
    expect(fromGenerated).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);

    // The half that must not move: a genuine organizer upload always wins.
    expect(getDisplayCover('https://cdn.example.com/real.jpg', 'Education', 'books'))
      .toBe('https://cdn.example.com/real.jpg');
  });

  it('scopes known catalog stock without replacing organizer uploads', () => {
    const catalogCover = CATEGORY_PHOTOS.Education[0];
    expect(isCatalogCover(catalogCover)).toBe(true);
    expect(isCatalogCover('/media/subject?category=Community&key=catalog-1')).toBe(true);
    expect(isCatalogCover('/media/subject?category=Community&key=migration-20260903-campaign-1')).toBe(true);
    // ⚠️ These three used to expect generated art (`/media/subject?...`). Page
    // scoping still does its job — it varies which image a campaign shows on a
    // second surface so a listing does not repeat one photo — but the thing it
    // now varies BETWEEN is photographs.
    const scoped = getDisplayCover(catalogCover, 'Education', 'books', 'search');
    expect(scoped).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    expect(scoped, 'page scope must still change the image').not.toBe(
      getDisplayCover(catalogCover, 'Education', 'books'),
    );

    // Unchanged, and the reason scoping is conditional at all: an organizer's
    // own upload is never varied by page.
    expect(getDisplayCover('https://cdn.example.com/real.jpg', 'Education', 'books', 'search'))
      .toBe('https://cdn.example.com/real.jpg');

    expect(getDisplayCover('/media/subject?category=Education&key=books', 'Education', 'books', 'search'))
      .toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });
});

describe('getCoverForCategory / getPhotosForCategory (existing API preserved)', () => {
  it('getCoverForCategory returns the category cover', () => {
    expect(getCoverForCategory('Education')).toBe(CATEGORY_PHOTOS['Education'][0]);
  });

  it('getPhotosForCategory returns at least the requested count', () => {
    expect(getPhotosForCategory('Medical', 4).length).toBeGreaterThanOrEqual(4);
    expect(getPhotosForCategory(null, 4).length).toBeGreaterThanOrEqual(4);
  });

  it('fills a realistic gallery entirely with distinct photographs', () => {
    // ⚠️ Was a 20-image request asserting the overflow was generated art. Real
    // callers ask for 1–6 (one asks 14) and pools hold 6–7, so a realistic
    // gallery is now all photography with no repeats — which is exactly what the
    // campaign gallery thumbnails needed: they were rendering as
    // "Campaign … Gallery 2/3/4" placeholder cards.
    const photos = getPhotosForCategory('Event', 6);
    expect(new Set(photos).size, 'a gallery must not repeat an image').toBe(photos.length);
    expect(photos.every((url) => url.startsWith('https://images.unsplash.com/photo-'))).toBe(true);
  });

  it('beyond the pool it REPEATS photos rather than inserting generated art', () => {
    // Stated rather than hidden: past the pool size the only options are a
    // repeated photograph or a non-photograph, and a repeat is the lesser harm.
    // A larger verified pool — or UNSPLASH_ACCESS_KEY, which returns unique
    // themed photos per campaign — is what removes this ceiling.
    const photos = getPhotosForCategory('Event', 20);
    expect(photos).toHaveLength(20);
    expect(photos.every((url) => url.startsWith('https://images.unsplash.com/photo-'))).toBe(true);
    expect(new Set(photos).size).toBeLessThan(photos.length);
  });

  it('varies page-scoped editorial images between pages', () => {
    // ⚠️ Was `size === 12` — every image across two pages unique. With a 6–7
    // photo pool per category that is only possible by generating art. The pages
    // must still LOOK different, which is what is asserted now: each page has no
    // internal repeat, and the two pages do not open on the same image.
    const first = getPhotosForPage('Medical', 'reports', 6);
    const second = getPhotosForPage('Medical', 'donate', 6);
    expect(new Set(first).size, 'a page repeats an image within itself').toBe(first.length);
    expect(new Set(second).size).toBe(second.length);
    expect(first[0], 'two pages start on the same image').not.toBe(second[0]);
    expect([...first, ...second].every((u) => u.startsWith('https://images.unsplash.com/photo-'))).toBe(true);
  });

  it('coordinates sections so a rendered page never repeats a photograph', () => {
    const photos = getDistinctPhotosForItems(Array.from({ length: 20 }, (_, index) => ({
      category: index < 8 ? 'Community' : index < 14 ? 'Education' : 'Medical',
      key: `page-section-${index}`,
    })));
    expect(photos).toHaveLength(20);
    expect(new Set(photos.map(idOf)).size).toBe(photos.length);
    expect(photos.every((url) => url.startsWith('https://images.unsplash.com/photo-'))).toBe(true);
  });
});
