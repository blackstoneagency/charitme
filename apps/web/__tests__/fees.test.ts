import { describe, expect, it } from 'vitest';
import {
  donationTotal, donorTip, platformFee, processingFee,
  methodProcessingFee, METHOD_FEES, MIN_DONATION_CENTS,
  donationBreakdown, SUPPORT_TIER_PERCENTS, SUGGESTED_SUPPORT_PERCENT,
  TIP_OPTIONS, DEFAULT_DONOR_TIP_PERCENT, netToFundraiser,
  DEFAULT_DONATION_CHECKOUT_SETTINGS, normalizeDonationCheckoutSettings,
} from '@shared/fees';

describe('netToFundraiser (0% platform fee promise)', () => {
  it('returns the full donation amount — fundraiser keeps 100%', () => {
    for (const cents of [100, 2_500, 10_000, 99_999, 1_000_000_00]) {
      expect(netToFundraiser(cents)).toBe(cents);
    }
  });

  it('always equals amount minus platformFee (invariant survives fee changes)', () => {
    for (const cents of [100, 5_000, 250_000]) {
      expect(netToFundraiser(cents)).toBe(cents - platformFee(cents));
    }
  });

  it('never exceeds the donation and is non-negative', () => {
    for (const cents of [0, 1, 100, 50_000]) {
      const net = netToFundraiser(cents);
      expect(net).toBeLessThanOrEqual(cents);
      expect(net).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('donor support model', () => {
  it('suggests 15% support and always allows opting down to 0', () => {
    expect(DEFAULT_DONOR_TIP_PERCENT).toBe(15);
    expect(TIP_OPTIONS[0]).toBe(15);          // suggested first
    expect(TIP_OPTIONS).toContain(0);         // opt-out always available
    expect([...TIP_OPTIONS]).toEqual([15, 12, 10, 8, 5, 3, 1, 0]);
  });
  it('keeps the mandatory platform fee at 0%', () => {
    expect(platformFee(100_00)).toBe(0);
    expect(PLATFORM_FEE_PERCENT_IS_ZERO()).toBe(true);
  });
});
function PLATFORM_FEE_PERCENT_IS_ZERO() { return platformFee(1) === 0 && platformFee(1_000_000) === 0; }

describe('CharitMe fee model', () => {
  it('uses 0% mandatory platform fee', () => {
    expect(platformFee(10_000)).toBe(0);
  });

  it('calculates optional donor tips', () => {
    expect(donorTip(10_000, 8)).toBe(800);
  });

  it('never returns a negative tip', () => {
    expect(donorTip(10_000, 0)).toBe(0);
    expect(donorTip(0, 8)).toBe(0);
  });

  it('shows transparent total with processing coverage', () => {
    expect(donationTotal(10_000, true, 8)).toBe(10_000 + 800 + processingFee(10_000));
  });
});

describe('methodProcessingFee — per-method rates (server/client authoritative)', () => {
  it('applies stripe/card 2.9% + $0.30', () => {
    // 2.9% of $100.00 = $2.90 (290c) + 30c = 320c
    expect(methodProcessingFee(10_000, 'stripe')).toBe(320);
    expect(methodProcessingFee(10_000, 'card')).toBe(320);
    expect(methodProcessingFee(10_000, 'gpay')).toBe(320);
  });

  it('applies paypal 3.49% + $0.49', () => {
    expect(methodProcessingFee(10_000, 'paypal')).toBe(Math.round(10_000 * 0.0349) + 49);
  });

  it('applies venmo 1.9% + $0.10', () => {
    expect(methodProcessingFee(10_000, 'venmo')).toBe(Math.round(10_000 * 0.019) + 10);
  });

  it('caps the bank (ACH) fee at $5.00', () => {
    // 0.8% of $10,000 = $80 → capped to 500c
    expect(methodProcessingFee(1_000_000, 'bank')).toBe(METHOD_FEES.bank.cap);
    // small amount stays under the cap
    expect(methodProcessingFee(10_000, 'bank')).toBe(Math.round(10_000 * 0.008));
  });

  it('rounds the percentage component (no fractional cents)', () => {
    const fee = methodProcessingFee(333, 'stripe'); // 2.9% of 333 = 9.657 → round 10, +30 = 40
    expect(Number.isInteger(fee)).toBe(true);
    expect(fee).toBe(Math.round(333 * 0.029) + 30);
  });

  it('MATCHES the checkout composition: fee is charged on (donation + tip)', () => {
    // Mirrors both DonateButton.tsx and /api/donations/route.ts:
    //   subTotal = amountCents + donorTip(amountCents); fee = methodProcessingFee(subTotal, method)
    const amountCents = 5_000;
    const tip = donorTip(amountCents, 8);            // 400
    const subTotal = amountCents + tip;              // 5400
    const clientFee = methodProcessingFee(subTotal, 'stripe');
    const serverFee = methodProcessingFee(amountCents + donorTip(amountCents, 8), 'stripe');
    expect(clientFee).toBe(serverFee);               // displayed == charged (§8.1 #5)
    // and it is strictly larger than a fee computed on the donation alone
    expect(clientFee).toBeGreaterThan(methodProcessingFee(amountCents, 'stripe'));
  });

  it('handles the minimum donation without error', () => {
    expect(methodProcessingFee(MIN_DONATION_CENTS, 'stripe')).toBe(Math.round(MIN_DONATION_CENTS * 0.029) + 30);
  });
});

describe('donor support model (transparency-first, no dark patterns)', () => {
  it('suggests 15% but the ladder always reaches 0%', () => {
    expect(SUGGESTED_SUPPORT_PERCENT).toBe(15);
    expect(DEFAULT_DONOR_TIP_PERCENT).toBe(15);
    expect(SUPPORT_TIER_PERCENTS[0]).toBe(15);
    expect(SUPPORT_TIER_PERCENTS).toContain(0);
    // descending so the reduce-support choices are always visible
    const arr = [...SUPPORT_TIER_PERCENTS];
    expect(arr).toEqual([...arr].sort((a, b) => b - a));
  });
});

describe('donationBreakdown — single source of truth', () => {
  it('when the donor covers processing, the recipient receives 100% of the gift', () => {
    const b = donationBreakdown({ amountCents: 10_000, supportPercent: 15, method: 'card', coverProcessing: true });
    expect(b.donationCents).toBe(10_000);
    expect(b.supportCents).toBe(1_500);
    expect(b.netToRecipientCents).toBe(10_000); // full gift
    expect(b.recipientPercent).toBe(100);
    // charged = gift + support + processing(on gift+support)
    expect(b.totalChargedCents).toBe(10_000 + 1_500 + methodProcessingFee(11_500, 'card'));
  });

  it('when the donor does NOT cover processing, only the processor fee comes out of the gift', () => {
    const b = donationBreakdown({ amountCents: 10_000, supportPercent: 0, method: 'card', coverProcessing: false });
    const proc = methodProcessingFee(10_000, 'card');
    expect(b.supportCents).toBe(0);
    expect(b.netToRecipientCents).toBe(10_000 - proc);
    expect(b.totalChargedCents).toBe(10_000); // support 0, processing not added on top
    expect(b.recipientPercent).toBeLessThan(100);
  });

  it('support never reduces what the recipient receives (support is on top)', () => {
    const withSupport = donationBreakdown({ amountCents: 10_000, supportPercent: 15, coverProcessing: true });
    const noSupport = donationBreakdown({ amountCents: 10_000, supportPercent: 0, coverProcessing: true });
    expect(withSupport.netToRecipientCents).toBe(noSupport.netToRecipientCents);
    expect(withSupport.totalChargedCents).toBeGreaterThan(noSupport.totalChargedCents);
  });

  it('matches DonateButton composition: processing is charged on (donation + support)', () => {
    const b = donationBreakdown({ amountCents: 5_000, supportPercent: 8, method: 'stripe', coverProcessing: true });
    expect(b.processingCents).toBe(methodProcessingFee(5_000 + donorTip(5_000, 8), 'stripe'));
  });

  it('clamps support to 0–100 and defaults to the suggested tier', () => {
    expect(donationBreakdown({ amountCents: 10_000, supportPercent: -5 }).supportPercent).toBe(0);
    expect(donationBreakdown({ amountCents: 10_000, supportPercent: 250 }).supportPercent).toBe(100);
    expect(donationBreakdown({ amountCents: 10_000 }).supportPercent).toBe(SUGGESTED_SUPPORT_PERCENT);
  });

  it('is safe at a zero gift (no divide-by-zero)', () => {
    const b = donationBreakdown({ amountCents: 0, supportPercent: 15 });
    expect(b.netToRecipientCents).toBe(0);
    expect(b.recipientPercent).toBe(0);
  });
});

describe('Supabase-configurable donation checkout settings', () => {
  it('ships the requested six amount choices and an explicit 0% fee choice', () => {
    const settings = normalizeDonationCheckoutSettings(DEFAULT_DONATION_CHECKOUT_SETTINGS);
    expect(settings.amountPresetsCents).toEqual([2_500, 5_000, 7_500, 10_000, 15_000, 25_000]);
    expect(settings.popularAmountCents).toBe(5_000);
    expect(settings.supportTierPercents).toEqual([15, 12, 10, 8, 5, 3, 1, 0]);
  });

  it('normalizes valid admin values into stable display order and regenerated labels', () => {
    const settings = normalizeDonationCheckoutSettings({
      amountPresetsCents: [99_00, 25_00, 10_00, 50_00, 75_00, 125_00],
      popularAmountCents: 75_00,
      supportTierPercents: [0, 2, 4, 6, 8, 10, 12, 14],
      defaultSupportPercent: 8,
      methodFees: {
        stripe: { pct: 3.25, fixed: 42, label: 'stale' },
        gpay: { pct: 3.25, fixed: 42, label: 'stale' },
        card: { pct: 3.25, fixed: 42, label: 'stale' },
        bank: { pct: 0.6, fixed: 0, cap: 400, label: 'stale' },
      },
    });

    expect(settings.amountPresetsCents).toEqual([1_000, 2_500, 5_000, 7_500, 9_900, 12_500]);
    expect(settings.supportTierPercents).toEqual([14, 12, 10, 8, 6, 4, 2, 0]);
    expect(settings.methodFees.stripe.label).toBe('3.25% + $0.42');
    expect(settings.methodFees.bank.label).toBe('0.6% (max $4)');
  });

  it('fails closed to complete defaults when arrays or references are malformed', () => {
    const settings = normalizeDonationCheckoutSettings({
      amountPresetsCents: [2_500, 2_500],
      popularAmountCents: 99_999,
      supportTierPercents: [15, 12, 10, 8, 5, 3, 1, 2],
      defaultSupportPercent: 99,
    });

    expect(settings.amountPresetsCents).toEqual(DEFAULT_DONATION_CHECKOUT_SETTINGS.amountPresetsCents);
    expect(settings.popularAmountCents).toBe(DEFAULT_DONATION_CHECKOUT_SETTINGS.popularAmountCents);
    expect(settings.supportTierPercents).toContain(0);
    expect(settings.defaultSupportPercent).toBe(DEFAULT_DONATION_CHECKOUT_SETTINGS.defaultSupportPercent);
  });

  it('uses the runtime processor configuration in the exact checkout breakdown', () => {
    const methodFees = normalizeDonationCheckoutSettings({
      ...DEFAULT_DONATION_CHECKOUT_SETTINGS,
      methodFees: {
        ...DEFAULT_DONATION_CHECKOUT_SETTINGS.methodFees,
        stripe: { pct: 4, fixed: 50, label: 'ignored' },
      },
    }).methodFees;
    const breakdown = donationBreakdown({
      amountCents: 10_000,
      supportPercent: 10,
      method: 'stripe',
      methodFees,
      coverProcessing: true,
    });

    expect(breakdown.processingCents).toBe(490);
    expect(breakdown.totalChargedCents).toBe(11_490);
  });
});
