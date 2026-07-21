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

describe('getCoverForCampaign — unique theme-matched per-campaign cover', () => {
  // Post-CHAR-SM2: covers are per-campaign-unique LoremFlickr photos keyed on the
  // category theme keyword + a stable per-campaign lock (not drawn from the
  // CATEGORY_PHOTOS Unsplash pool, which now backs category cover / grids only).
  const lockOf = (url: string) => Number((url.match(/lock=(\d+)/) || [])[1]);

  it('is deterministic: same key always yields the same cover', () => {
    const a = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    const b = getCoverForCampaign('Medical', 'help-sarah-fight-cancer');
    expect(a).toBe(b);
  });

  it('returns a themed LoremFlickr URL keyed on the category', () => {
    // Medical → hospital
    expect(getCoverForCampaign('Medical', 'k')).toMatch(
      /^https:\/\/loremflickr\.com\/800\/450\/hospital\?lock=\d+$/,
    );
    // Education → school
    expect(getCoverForCampaign('Education', 'k')).toContain('/school?lock=');
  });

  it('gives distinct covers to distinct campaigns (spreads via the lock)', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 200; i++) picks.add(getCoverForCampaign('Medical', `medical-campaign-${i}`));
    // 200 varied keys should produce many distinct locks (near-collision-free).
    expect(picks.size).toBeGreaterThan(150);
  });

  it('falls back to the generic "charity" theme for unknown categories', () => {
    expect(getCoverForCampaign('NoSuchCategory', 'k')).toContain('/charity?lock=');
  });

  it('still returns a stable themed cover when no key is provided', () => {
    const a = getCoverForCampaign('Medical', null);
    const b = getCoverForCampaign('Medical', '');
    expect(a).toBe(b);
    expect(a).toContain('/hospital?lock=');
    expect(lockOf(a)).toBeGreaterThanOrEqual(1000);
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
