import { describe, it, expect } from 'vitest';
import { VALID_CATEGORIES, DEFAULTS } from '../lib/settings-defaults';

// Admin settings pages read a category's config from DEFAULTS keyed by
// VALID_CATEGORIES. A drift between the two (a category with no defaults, or an
// orphan defaults block) would break a settings tab, so guard the invariant.

describe('settings defaults integrity', () => {
  it('DEFAULTS has exactly one block per valid category (no missing/orphan)', () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual([...VALID_CATEGORIES].sort());
  });

  it('category names are unique', () => {
    expect(new Set(VALID_CATEGORIES).size).toBe(VALID_CATEGORIES.length);
  });

  it('every category default block is a non-empty object', () => {
    for (const cat of VALID_CATEGORIES) {
      const block = DEFAULTS[cat];
      expect(block && typeof block === 'object', `${cat} block`).toBe(true);
      expect(Object.keys(block).length, `${cat} has no defaults`).toBeGreaterThan(0);
    }
  });

  it('payment defaults are sane (fee %, positive featured price)', () => {
    const pay = DEFAULTS.payment;
    expect(typeof pay.platformFeePct).toBe('number');
    expect(pay.platformFeePct as number).toBeGreaterThanOrEqual(0);
    expect(pay.platformFeePct as number).toBeLessThanOrEqual(100);
    expect(Number.isInteger(pay.featuredCampaignPriceCents)).toBe(true);
    expect(pay.featuredCampaignPriceCents as number).toBeGreaterThan(0);
    expect(typeof pay.currency).toBe('string');
    expect((pay.currency as string).length).toBe(3);
  });
});
