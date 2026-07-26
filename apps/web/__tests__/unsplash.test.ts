import { describe, it, expect, beforeEach } from 'vitest';
import { categoryQuery, unsplashCoverUrl, pickCoverIndex, unsplashCoverForCampaign } from '../lib/unsplash';

describe('categoryQuery', () => {
  it('maps a known category to a themed query', () => {
    expect(categoryQuery('Medical')).toBe('hospital healthcare');
    expect(categoryQuery('Education')).toBe('school classroom students');
  });

  it('falls back to a generic charity query for unknown/empty categories', () => {
    expect(categoryQuery('NoSuchCategory')).toBe('charity community help');
    expect(categoryQuery(null)).toBe('charity community help');
    expect(categoryQuery(undefined)).toBe('charity community help');
  });
});

describe('unsplashCoverUrl', () => {
  it('appends sizing/crop params to a raw URL that has no query string', () => {
    expect(unsplashCoverUrl('https://images.unsplash.com/photo-abc')).toBe(
      'https://images.unsplash.com/photo-abc?auto=format&fit=crop&crop=entropy&w=800&h=600&q=80',
    );
  });

  it('uses & when the raw URL already has a query string', () => {
    expect(unsplashCoverUrl('https://images.unsplash.com/photo-abc?ixid=xyz')).toBe(
      'https://images.unsplash.com/photo-abc?ixid=xyz&auto=format&fit=crop&crop=entropy&w=800&h=600&q=80',
    );
  });

  it('honors custom dimensions', () => {
    expect(unsplashCoverUrl('https://images.unsplash.com/photo-abc', 1200, 675)).toContain('w=1200&h=675');
  });
});

describe('pickCoverIndex', () => {
  it('is deterministic for a given seed + length', () => {
    expect(pickCoverIndex('help-sarah', 30)).toBe(pickCoverIndex('help-sarah', 30));
  });

  it('stays within [0, len)', () => {
    for (const seed of ['a', 'campaign-42', 'x'.repeat(64), '']) {
      const i = pickCoverIndex(seed, 30);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(30);
    }
  });

  it('spreads distinct seeds across different indices (uniqueness)', () => {
    const seeds = Array.from({ length: 12 }, (_, n) => `campaign-${n}`);
    const indices = new Set(seeds.map((s) => pickCoverIndex(s, 30)));
    // Not a strict guarantee, but FNV-1a over 12 distinct seeds into 30 slots
    // should almost never collapse to a single bucket.
    expect(indices.size).toBeGreaterThan(6);
  });

  it('is safe for a zero-length pool', () => {
    expect(pickCoverIndex('anything', 0)).toBe(0);
  });
});

describe('unsplashCoverForCampaign (no key configured)', () => {
  beforeEach(() => { delete process.env.UNSPLASH_ACCESS_KEY; });

  it('returns null without an access key — no network, callers fall back', async () => {
    await expect(unsplashCoverForCampaign('Medical', 'help-sarah')).resolves.toBeNull();
  });
});
