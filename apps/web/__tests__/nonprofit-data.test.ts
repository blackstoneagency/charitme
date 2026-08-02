import { describe, expect, it } from 'vitest';
import {
  buildNonprofitSummary,
  isNonprofitVerified,
  normalizeVerificationStatus,
} from '../lib/nonprofit-data';

// ─────────────────────────────────────────────────────────────────────────────
// Nonprofit portal — verification and tax-receipt logic.
//
// The dashboard tells an organization whether its donors are receiving
// tax-deductible receipts. That answer MUST match what lib/tax-server.ts actually
// does per donation:
//
//   verified   := Boolean(np.verified) || np.verification_status === 'verified'
//   receipt    := verified && np.tax_receipt_enabled
//
// Claiming donors are covered when they aren't would be a tax-consequential lie,
// so the rule is pinned here rather than left to drift.
// ─────────────────────────────────────────────────────────────────────────────

const row = (over: Record<string, unknown> = {}) => ({
  id: 'np1', name: 'Helping Hands', slug: 'helping-hands', mission: 'We help',
  tax_id: '12-3456789', website_url: null, country: 'US', address: null,
  verified: false, verification_status: 'unverified',
  tax_receipt_enabled: false, public_profile_enabled: true, ...over,
}) as never;

describe('isNonprofitVerified — mirrors tax-server', () => {
  it('counts the legacy boolean alone', () => {
    expect(isNonprofitVerified(true, 'unverified')).toBe(true);
  });
  it('counts the status column alone', () => {
    expect(isNonprofitVerified(false, 'verified')).toBe(true);
  });
  it('is false when neither is set', () => {
    expect(isNonprofitVerified(false, 'pending')).toBe(false);
    expect(isNonprofitVerified(null, null)).toBe(false);
  });
  it('does not treat rejected or pending as verified', () => {
    expect(isNonprofitVerified(false, 'rejected')).toBe(false);
    expect(isNonprofitVerified(false, 'pending')).toBe(false);
  });
});

describe('donorsGetTaxReceipts — BOTH conditions required', () => {
  it('is false when verified but receipts are switched off', () => {
    const s = buildNonprofitSummary(row({ verified: true, tax_receipt_enabled: false }), []);
    expect(s.profile?.isVerified).toBe(true);
    expect(s.profile?.donorsGetTaxReceipts).toBe(false);
  });

  it('is false when receipts are on but the org is NOT verified', () => {
    // The dangerous direction: an org could switch receipts on and assume it is
    // covered. tax-server still refuses, so the dashboard must too.
    const s = buildNonprofitSummary(row({ verified: false, verification_status: 'pending', tax_receipt_enabled: true }), []);
    expect(s.profile?.donorsGetTaxReceipts).toBe(false);
  });

  it('is true only when verified AND receipts enabled', () => {
    const s = buildNonprofitSummary(row({ verification_status: 'verified', tax_receipt_enabled: true }), []);
    expect(s.profile?.donorsGetTaxReceipts).toBe(true);
  });

  it('honours the legacy boolean path too', () => {
    const s = buildNonprofitSummary(row({ verified: true, verification_status: 'unverified', tax_receipt_enabled: true }), []);
    expect(s.profile?.donorsGetTaxReceipts).toBe(true);
  });
});

describe('normalizeVerificationStatus', () => {
  it('passes through the four valid statuses', () => {
    for (const v of ['unverified', 'pending', 'verified', 'rejected']) {
      expect(normalizeVerificationStatus(v, false)).toBe(v);
    }
  });
  it('falls back to the boolean for a null/garbage status', () => {
    expect(normalizeVerificationStatus(null, true)).toBe('verified');
    expect(normalizeVerificationStatus('nonsense', false)).toBe('unverified');
  });
});

describe('buildNonprofitSummary', () => {
  it('handles a user with no nonprofit profile', () => {
    const s = buildNonprofitSummary(null, []);
    expect(s.profile).toBeNull();
    expect(s.campaigns).toEqual([]);
    expect(s.totalRaisedCents).toBe(0);
  });

  it('totals raised and counts only active campaigns', () => {
    const s = buildNonprofitSummary(row(), [
      { id: 'c1', slug: 'a', title: 'A', status: 'active', goal_amount: 100_00, raised_amount: 60_00, backer_count: 2, cover_image_url: null, category: null },
      { id: 'c2', slug: 'b', title: 'B', status: 'completed', goal_amount: 100_00, raised_amount: 40_00, backer_count: 1, cover_image_url: null, category: null },
    ] as never);
    expect(s.totalRaisedCents).toBe(100_00);
    expect(s.activeCount).toBe(1);
  });

  it('treats null money columns as zero, not NaN', () => {
    const s = buildNonprofitSummary(row(), [
      { id: 'c1', slug: 'a', title: 'A', status: 'active', goal_amount: null, raised_amount: null, backer_count: null, cover_image_url: null, category: null },
    ] as never);
    expect(s.totalRaisedCents).toBe(0);
    expect(Number.isNaN(s.totalRaisedCents)).toBe(false);
  });

  it('defaults public_profile_enabled to true only when not explicitly false', () => {
    expect(buildNonprofitSummary(row({ public_profile_enabled: null }), []).profile?.publicProfileEnabled).toBe(true);
    expect(buildNonprofitSummary(row({ public_profile_enabled: false }), []).profile?.publicProfileEnabled).toBe(false);
  });
});

describe('the metric tiles on /dashboard/nonprofit', () => {
  const campaign = (over: Record<string, unknown> = {}) => ({
    id: 'c1', slug: 'c1', title: 'C1', status: 'active',
    goal_amount: 10_000, raised_amount: 0, backer_count: 0,
    cover_image_url: null, category: null, ...over,
  });

  it('sums supporters across campaigns WITHOUT deduplicating, and says so', () => {
    // `backer_count` is a per-campaign tally, so a donor who gave to two of the
    // organisation's campaigns is counted twice. That is the honest limit of
    // this number — the tile is labelled "Supporters ... not deduplicated"
    // rather than "Total Donors", which would overstate reach.
    const s = buildNonprofitSummary(row(), [
      campaign({ id: 'a', backer_count: 12 }),
      campaign({ id: 'b', backer_count: 30 }),
    ] as never);
    expect(s.totalSupporters).toBe(42);
  });

  it('ignores a negative stored backer count rather than subtracting it', () => {
    const s = buildNonprofitSummary(row(), [
      campaign({ id: 'a', backer_count: -5 }),
      campaign({ id: 'b', backer_count: 7 }),
    ] as never);
    expect(s.totalSupporters).toBe(7);
  });

  it('counts a campaign funded only when it reached a real goal', () => {
    const s = buildNonprofitSummary(row(), [
      campaign({ id: 'met', goal_amount: 1_000, raised_amount: 1_000 }),
      campaign({ id: 'over', goal_amount: 1_000, raised_amount: 2_500 }),
      campaign({ id: 'under', goal_amount: 1_000, raised_amount: 999 }),
      // No goal: there is nothing to have reached, so counting it would inflate
      // the figure with drafts.
      campaign({ id: 'nogoal', goal_amount: 0, raised_amount: 5_000 }),
    ] as never);
    expect(s.fundedCount).toBe(2);
  });

  it('is zero on both counts for an organisation with no campaigns', () => {
    const s = buildNonprofitSummary(row(), []);
    expect(s.totalSupporters).toBe(0);
    expect(s.fundedCount).toBe(0);
  });

  it('does NOT expose an "impact reached" figure', () => {
    // The reference artwork shows an "Impact Reached: 12,540" tile. Nothing in
    // the schema measures impact, so inventing one would put a fabricated
    // statistic on a nonprofit's own dashboard — the number most likely to be
    // repeated to funders.
    const s = buildNonprofitSummary(row(), []);
    expect(Object.keys(s)).not.toContain('impactReached');
  });
});
