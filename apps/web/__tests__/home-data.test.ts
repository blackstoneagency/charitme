import { describe, expect, it } from 'vitest';
import { aggregateCategoryStats, mapRecentDonations, type RawDonationRow } from '../lib/home-data';

describe('aggregateCategoryStats', () => {
  it('counts campaigns and sums supporters per category, most-first', () => {
    const out = aggregateCategoryStats([
      { category: 'Medical', backer_count: 10 },
      { category: 'Medical', backer_count: 5 },
      { category: 'Animal', backer_count: 3 },
    ]);
    expect(out).toEqual([
      { category: 'Medical', count: 2, supporters: 15 },
      { category: 'Animal', count: 1, supporters: 3 },
    ]);
  });

  it('buckets null categories under Community and treats null backers as 0', () => {
    const out = aggregateCategoryStats([
      { category: null, backer_count: null },
      { category: null, backer_count: 4 },
    ]);
    expect(out).toEqual([{ category: 'Community', count: 2, supporters: 4 }]);
  });

  it('returns an empty array for no rows', () => {
    expect(aggregateCategoryStats([])).toEqual([]);
  });
});

describe('mapRecentDonations', () => {
  const base = (over: Partial<RawDonationRow>): RawDonationRow => ({
    id: 'd1', amount_cents: 2500, anonymous: false, created_at: '2026-07-19T00:00:00Z',
    offline_donor_name: null,
    campaigns: { title: 'Help Anthony', slug: 'help-anthony', visibility: 'public' },
    profiles: { full_name: 'Jane Donor' },
    ...over,
  });

  it('uses the donor profile name for non-anonymous donations', () => {
    const [d] = mapRecentDonations([base({})], 8);
    expect(d.name).toBe('Jane Donor');
    expect(d.campaignTitle).toBe('Help Anthony');
    expect(d.campaignSlug).toBe('help-anthony');
    expect(d.amountCents).toBe(2500);
  });

  it('redacts anonymous donors regardless of profile', () => {
    const [d] = mapRecentDonations([base({ anonymous: true })], 8);
    expect(d.name).toBe('Anonymous');
  });

  it('falls back to the offline name, then a friendly default', () => {
    expect(mapRecentDonations([base({ profiles: null, offline_donor_name: 'Sam' })], 8)[0].name).toBe('Sam');
    expect(mapRecentDonations([base({ profiles: null, offline_donor_name: null })], 8)[0].name).toBe('A kind supporter');
  });

  it('never surfaces donations to private campaigns', () => {
    const rows = [
      base({ id: 'a', campaigns: { title: 'Private', slug: 'p', visibility: 'private' } }),
      base({ id: 'b' }),
    ];
    const out = mapRecentDonations(rows, 8);
    expect(out.map((d) => d.id)).toEqual(['b']);
  });

  it('skips donations whose campaign join is missing', () => {
    const out = mapRecentDonations([base({ campaigns: null }), base({ id: 'b' })], 8);
    expect(out.map((d) => d.id)).toEqual(['b']);
  });

  it('handles PostgREST returning the join as an array', () => {
    const [d] = mapRecentDonations([base({ campaigns: [{ title: 'T', slug: 's', visibility: 'public' }], profiles: [{ full_name: 'Ann' }] })], 8);
    expect(d.name).toBe('Ann');
    expect(d.campaignSlug).toBe('s');
  });

  it('treats a missing visibility field (column absent) as visible', () => {
    const [d] = mapRecentDonations([base({ campaigns: { title: 'T', slug: 's' } })], 8);
    expect(d.campaignSlug).toBe('s');
  });

  it('caps the result at the requested limit', () => {
    const rows = Array.from({ length: 10 }, (_, i) => base({ id: `d${i}` }));
    expect(mapRecentDonations(rows, 3)).toHaveLength(3);
  });
});
