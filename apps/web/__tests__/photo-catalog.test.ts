import { describe, it, expect } from 'vitest';
import {
  CATEGORY_PHOTOS,
  FALLBACK_PHOTOS,
  getCoverForCategory,
  getCoverForCampaign,
  getPhotosForCategory,
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

  it('every URL is an approved-host Unsplash image with sizing params', () => {
    const all = [...Object.values(CATEGORY_PHOTOS).flat(), ...FALLBACK_PHOTOS];
    for (const url of all) {
      expect(url.startsWith('https://images.unsplash.com/photo-')).toBe(true);
      expect(url).toMatch(/[?&]w=\d+/);
      expect(url).toMatch(/[?&]q=\d+/);
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
  // Covers are per-campaign-unique Lorem Picsum photos seeded on the campaign's
  // stable key (slug/id). Distinct keys → distinct seeds → distinct images, which
  // eliminates the LoremFlickr small-pool duplicate-photo problem.
  it('is deterministic: same key always yields the same cover', () => {
    const a = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    const b = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    expect(a).toBe(b);
  });

  it('returns a Picsum seed URL keyed on the campaign key', () => {
    expect(getCoverForCampaign('Medical', 'help-sarah')).toBe(
      'https://picsum.photos/seed/cm-help-sarah/800/600',
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
      'https://picsum.photos/seed/cm-a%20b%2Fc/800/600',
    );
  });

  it('falls back to a stable category-based seed when no key is provided', () => {
    const a = getCoverForCampaign('Medical', null);
    const b = getCoverForCampaign('Medical', '');
    expect(a).toBe(b);
    expect(a).toBe('https://picsum.photos/seed/cm-cat-Medical/800/600');
    expect(getCoverForCampaign(null, null)).toBe('https://picsum.photos/seed/cm-cat-charity/800/600');
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
});
