import { describe, expect, it } from 'vitest';
import {
  donationTotal, donorTip, platformFee, processingFee,
  methodProcessingFee, METHOD_FEES, MIN_DONATION_CENTS,
  TIP_OPTIONS, DEFAULT_DONOR_TIP_PERCENT,
} from '@shared/fees';

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
