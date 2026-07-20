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

describe('getCoverForCampaign — deterministic per-campaign spread', () => {
  it('is deterministic: same key always yields the same cover', () => {
    const a = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    const b = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    expect(a).toBe(b);
  });

  it('spreads many campaigns across the pool (not all pool[0])', () => {
    const pool = CATEGORY_PHOTOS['Medical'];
    const picks = new Set<string>();
    for (let i = 0; i < 200; i++) picks.add(getCoverForCampaign('Medical', `medical-campaign-${i}`));
    // With 200 varied keys over a pool of N, we expect to hit most of the pool.
    expect(picks.size).toBeGreaterThan(1);
    expect(picks.size).toBeLessThanOrEqual(pool.length);
    for (const p of picks) expect(pool).toContain(p);
  });

  it('always returns a photo from the category pool', () => {
    for (const cat of categories) {
      const url = getCoverForCampaign(cat, `${cat}-xyz`);
      expect(CATEGORY_PHOTOS[cat]).toContain(url);
    }
  });

  it('falls back to the fallback pool for unknown categories', () => {
    const url = getCoverForCampaign('NoSuchCategory', 'k');
    expect(FALLBACK_PHOTOS).toContain(url);
  });

  it('returns pool[0] when no key is provided (stable default)', () => {
    expect(getCoverForCampaign('Medical', null)).toBe(CATEGORY_PHOTOS['Medical'][0]);
    expect(getCoverForCampaign('Medical', '')).toBe(CATEGORY_PHOTOS['Medical'][0]);
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
