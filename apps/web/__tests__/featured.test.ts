import { describe, expect, it } from 'vitest';
import {
  resolveFeaturePriceCents,
  selectRotatorCampaigns,
  FEATURE_PRICE_DEFAULT_CENTS,
  FEATURE_PRICE_MIN_CENTS,
  FEATURE_PRICE_MAX_CENTS,
} from '../lib/featured';

describe('resolveFeaturePriceCents', () => {
  it('reads the admin-configured price from payment settings', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 500 })).toBe(500);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 2500 })).toBe(2500);
  });

  it('falls back to the $5 default when unset, zero, or non-numeric', () => {
    expect(resolveFeaturePriceCents(undefined)).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({})).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 0 })).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 'abc' })).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents(null)).toBe(FEATURE_PRICE_DEFAULT_CENTS);
  });

  it('clamps out-of-range values to the sane min/max', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 5 })).toBe(FEATURE_PRICE_MIN_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 9_999_999 })).toBe(FEATURE_PRICE_MAX_CENTS);
  });

  it('rounds fractional cents to whole cents', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 599.6 })).toBe(600);
  });
});

describe('selectRotatorCampaigns', () => {
  const c = (id: string, featured: boolean) => ({ id, featured });

  it('returns only featured campaigns when at least one is featured', () => {
    const list = [c('a', false), c('b', true), c('c', false), c('d', true)];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['b', 'd']);
  });

  it('falls back to the full list when none are featured (hero never empty)', () => {
    const list = [c('a', false), c('b', false)];
    expect(selectRotatorCampaigns(list)).toHaveLength(2);
  });

  it('preserves the input order of featured campaigns (callers pre-sort by rank)', () => {
    const list = [c('x', true), c('y', false), c('z', true)];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['x', 'z']);
  });

  it('treats missing/null featured as not-featured', () => {
    const list = [{ id: 'a' }, { id: 'b', featured: null }, { id: 'c', featured: true }];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['c']);
  });
});
