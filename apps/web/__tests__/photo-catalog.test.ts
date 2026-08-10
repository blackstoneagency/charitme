import { describe, it, expect } from 'vitest';
import {
  CATEGORY_PHOTOS,
  FALLBACK_PHOTOS,
  getCoverForCategory,
  getCoverForCampaign,
  getDisplayCover,
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

  it('does not reuse a content image across category pools', () => {
    const all = Object.values(CATEGORY_PHOTOS).flat();
    expect(new Set(all.map(idOf)).size).toBe(all.length);
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

  it('returns a first-party subject URL keyed on the campaign key', () => {
    expect(getCoverForCampaign('Medical', 'help-sarah')).toBe(
      '/media/subject?category=Medical&key=help-sarah',
    );
  });

  it('gives a distinct URL to every distinct campaign key', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 200; i++) picks.add(getCoverForCampaign('Medical', `medical-campaign-${i}`));
    // 200 distinct keys → 200 distinct seed URLs (no collisions by construction).
    expect(picks.size).toBe(200);
  });

  it('url-encodes keys so odd slugs stay valid', () => {
    expect(getCoverForCampaign('Medical', 'a b/c')).toBe(
      '/media/subject?category=Medical&key=a+b%2Fc',
    );
  });

  it('falls back to a stable category-based seed when no key is provided', () => {
    const a = getCoverForCampaign('Medical', null);
    const b = getCoverForCampaign('Medical', '');
    expect(a).toBe(b);
    expect(a).toBe('/media/subject?category=Medical&key=cat-Medical');
    expect(getCoverForCampaign(null, null)).toBe('/media/subject?category=Community&key=cat-charity');
  });

  it('replaces generic stock placeholders but preserves organizer uploads', () => {
    expect(getDisplayCover('https://picsum.photos/id/7/800/600', 'Education', 'books'))
      .toBe('/media/subject?category=Education&key=books');
    expect(getDisplayCover('https://cdn.example.com/real.jpg', 'Education', 'books'))
      .toBe('https://cdn.example.com/real.jpg');
  });

  it('scopes known catalog stock without replacing organizer uploads', () => {
    const catalogCover = CATEGORY_PHOTOS.Education[0];
    expect(isCatalogCover(catalogCover)).toBe(true);
    expect(isCatalogCover('/media/subject?category=Community&key=catalog-1')).toBe(true);
    expect(isCatalogCover('/media/subject?category=Community&key=migration-20260903-campaign-1')).toBe(true);
    expect(getDisplayCover(catalogCover, 'Education', 'books', 'search')).toBe(
      '/media/subject?category=Education&key=search-books',
    );
    expect(getDisplayCover('https://cdn.example.com/real.jpg', 'Education', 'books', 'search'))
      .toBe('https://cdn.example.com/real.jpg');
    expect(getDisplayCover('/media/subject?category=Education&key=books', 'Education', 'books', 'search'))
      .toBe('/media/subject?category=Education&key=search-books');
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

  it('fills large galleries without cycling the curated pool', () => {
    const photos = getPhotosForCategory('Event', 20);
    expect(new Set(photos).size).toBe(photos.length);
    expect(photos.slice(CATEGORY_PHOTOS.Event.length).every((url) => url.startsWith('/media/subject?'))).toBe(true);
  });

  it('creates distinct page-scoped editorial images', () => {
    const first = getPhotosForPage('Medical', 'reports', 6);
    const second = getPhotosForPage('Medical', 'donate', 6);
    expect(new Set([...first, ...second]).size).toBe(12);
  });
});
