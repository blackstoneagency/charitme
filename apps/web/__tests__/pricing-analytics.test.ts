import { describe, expect, it } from 'vitest';
import {
  computePricingAnalytics,
  supportPercentOf,
  type DonationStatRow,
} from '../lib/pricing-analytics-core';
import { SUGGESTED_SUPPORT_PERCENT } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// Pricing/support analytics: how donors respond to optional support. Pins the
// support-% math, the "support reduction" definition (below the suggested 15%
// tier), tier bucketing, and divide-by-zero safety.
// ─────────────────────────────────────────────────────────────────────────────

const row = (amountCents: number, tipCents: number): DonationStatRow => ({ amountCents, tipCents });

describe('supportPercentOf', () => {
  it('is tip / gift as a percent', () => {
    expect(supportPercentOf(row(10_000, 1_500))).toBeCloseTo(15);
    expect(supportPercentOf(row(10_000, 0))).toBe(0);
  });
  it('is 0 for a zero or negative gift (no divide-by-zero)', () => {
    expect(supportPercentOf(row(0, 500))).toBe(0);
    expect(supportPercentOf(row(-100, 500))).toBe(0);
  });
});

describe('computePricingAnalytics', () => {
  it('returns a zeroed shape for no donations', () => {
    const a = computePricingAnalytics([]);
    expect(a.donationCount).toBe(0);
    expect(a.averageDonationCents).toBe(0);
    expect(a.supportReductionPercent).toBe(0);
    expect(a.buckets.every((b) => b.count === 0 && b.share === 0)).toBe(true);
  });

  it('computes gross, support revenue, and averages', () => {
    const a = computePricingAnalytics([
      row(10_000, 1_500), // 15%
      row(20_000, 1_000), // 5%
    ]);
    expect(a.donationCount).toBe(2);
    expect(a.grossDonationCents).toBe(30_000);
    expect(a.supportRevenueCents).toBe(2_500);
    expect(a.averageDonationCents).toBe(15_000);
    // simple mean of 15% and 5%
    expect(a.averageSupportPercent).toBe(10);
    // effective = 2500 / 30000
    expect(a.effectiveSupportPercent).toBeCloseTo(8.3, 1);
  });

  it('counts "support reduction" as donations below the suggested tier', () => {
    const a = computePricingAnalytics([
      row(10_000, 1_500), // 15% — above suggested, NOT reduced
      row(10_000, 800), // 8% — reduced
      row(10_000, 0), // 0% — reduced + zero
      row(10_000, 2_000), // 20% — above, NOT reduced
    ]);
    expect(SUGGESTED_SUPPORT_PERCENT).toBe(10);
    expect(a.supportReductionPercent).toBe(50); // 2 of 4 below 10%
    expect(a.zeroSupportPercent).toBe(25); // 1 of 4 left nothing
  });

  it('buckets donations by support tier and shares sum to ~100%', () => {
    const a = computePricingAnalytics([
      row(10_000, 0), // 0% none
      row(10_000, 300), // 3% → 0–5%
      row(10_000, 800), // 8% → 5–10%
      row(10_000, 1_200), // 12% → 10–15%
      row(10_000, 1_500), // 15% → 15%+
      row(10_000, 2_500), // 25% → 15%+
    ]);
    const byLabel = Object.fromEntries(a.buckets.map((b) => [b.label, b.count]));
    expect(byLabel['0% (none)']).toBe(1);
    expect(byLabel['0–5%']).toBe(1);
    expect(byLabel['5–10%']).toBe(1);
    expect(byLabel['10–15%']).toBe(1);
    expect(byLabel['15%+']).toBe(2);
    const totalShare = a.buckets.reduce((n, b) => n + b.share, 0);
    expect(totalShare).toBeGreaterThan(99);
    expect(totalShare).toBeLessThan(101);
  });

  it('every donation lands in exactly one bucket', () => {
    const rows = [row(10_000, 0), row(10_000, 500), row(10_000, 1_499), row(10_000, 1_500)];
    const a = computePricingAnalytics(rows);
    const bucketed = a.buckets.reduce((n, b) => n + b.count, 0);
    expect(bucketed).toBe(rows.length);
  });
});
