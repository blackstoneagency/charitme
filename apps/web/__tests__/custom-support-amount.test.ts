import { describe, it, expect } from 'vitest';
import {
  donationBreakdown,
  supportPercentFromCents,
  donorTip,
  methodProcessingFee,
  SUGGESTED_SUPPORT_PERCENT,
} from '@shared/fees';

// "Enter custom amount" lets a donor type an exact support figure instead of
// picking a percentage tier. The invariant that matters for money: the amount
// SHOWN in the breakdown must equal the amount CHARGED. Deriving the charge from
// a rounded percentage would drift, so the custom figure is carried through as
// exact cents (supportCentsOverride on the client, tipCents on the API).

describe('supportPercentFromCents (display only)', () => {
  it('reports the equivalent percentage to a tenth', () => {
    expect(supportPercentFromCents(5_000, 750)).toBe(15);
    expect(supportPercentFromCents(5_000, 700)).toBe(14);
    expect(supportPercentFromCents(10_000, 1_234)).toBe(12.3);
  });

  it('is safe for a zero or negative gift (no divide-by-zero)', () => {
    expect(supportPercentFromCents(0, 500)).toBe(0);
    expect(supportPercentFromCents(-100, 500)).toBe(0);
  });
});

describe('donationBreakdown with a custom support amount', () => {
  it('charges the exact cents entered, not a re-derived percentage', () => {
    // $7.13 on a $50 gift is 14.26% — a percentage round-trip would lose cents.
    const b = donationBreakdown({ amountCents: 5_000, supportCentsOverride: 713, coverProcessing: true });
    expect(b.supportCents).toBe(713);
    expect(b.totalChargedCents).toBe(5_000 + 713 + methodProcessingFee(5_713, 'card'));
  });

  it('overrides the tier percentage when both are supplied', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportPercent: 15, supportCentsOverride: 100 });
    expect(b.supportCents).toBe(100);            // custom wins
    expect(b.supportCents).not.toBe(donorTip(5_000, 15));
  });

  it('reports the equivalent percentage for display', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportCentsOverride: 700 });
    expect(b.supportPercent).toBe(14);
  });

  it('accepts a custom amount of exactly zero (opting out via the field)', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportPercent: 15, supportCentsOverride: 0 });
    expect(b.supportCents).toBe(0);
    expect(b.supportPercent).toBe(0);
    expect(b.totalChargedCents).toBe(5_000 + methodProcessingFee(5_000, 'card'));
  });

  it('never lets support reduce what the recipient receives', () => {
    const withCustom = donationBreakdown({ amountCents: 5_000, supportCentsOverride: 2_500, coverProcessing: true });
    const noSupport = donationBreakdown({ amountCents: 5_000, supportPercent: 0, coverProcessing: true });
    expect(withCustom.netToRecipientCents).toBe(noSupport.netToRecipientCents);
    expect(withCustom.netToRecipientCents).toBe(5_000);
  });

  it('clamps a negative custom amount to zero rather than crediting the donor', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportCentsOverride: -500 });
    expect(b.supportCents).toBe(0);
    expect(b.totalChargedCents).toBeGreaterThanOrEqual(5_000);
  });

  it('rounds a fractional custom amount to whole cents', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportCentsOverride: 712.6 });
    expect(Number.isInteger(b.supportCents)).toBe(true);
    expect(b.supportCents).toBe(713);
  });

  it('falls back to the tier percentage when no override is given', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportPercent: 10 });
    expect(b.supportCents).toBe(donorTip(5_000, 10));
    expect(b.supportPercent).toBe(10);
    const d = donationBreakdown({ amountCents: 5_000 });
    expect(d.supportPercent).toBe(SUGGESTED_SUPPORT_PERCENT);
  });

  it('processing is still charged on (gift + custom support), matching the server', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportCentsOverride: 713, method: 'stripe', coverProcessing: true });
    expect(b.processingCents).toBe(methodProcessingFee(5_000 + 713, 'stripe'));
  });

  it('the breakdown always sums exactly to the charged total', () => {
    for (const tip of [0, 1, 99, 713, 5_000, 100_000]) {
      const b = donationBreakdown({ amountCents: 5_000, supportCentsOverride: tip, coverProcessing: true });
      expect(b.donationCents + b.supportCents + b.processingCents).toBe(b.totalChargedCents);
    }
  });
});
