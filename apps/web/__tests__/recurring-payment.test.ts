import { describe, expect, it } from 'vitest';
import { resolveRecurringRenewalAmounts } from '../lib/recurring-payment';

describe('resolveRecurringRenewalAmounts', () => {
  it('preserves an exact metadata split', () => {
    expect(resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 11_500,
      metadataDonationAmount: '10000',
      metadataTipAmount: '1500',
    })).toEqual({ donationAmountCents: 10_000, tipCents: 1_500 });
  });

  it('preserves a zero-tip renewal', () => {
    expect(resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 10_000,
      metadataDonationAmount: '10000',
      metadataTipAmount: '0',
    })).toEqual({ donationAmountCents: 10_000, tipCents: 0 });
  });

  it('allocates credits proportionally when the configured split is known', () => {
    expect(resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 5_750,
      metadataDonationAmount: '10000',
      metadataTipAmount: '1500',
    })).toEqual({ donationAmountCents: 5_000, tipCents: 750 });
  });

  it('recovers a legacy tip from the stored principal', () => {
    expect(resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 11_500,
      storedDonationAmount: 10_000,
      storedTipAmount: 0,
    })).toEqual({ donationAmountCents: 10_000, tipCents: 1_500 });
  });

  it('treats a legacy discounted payment as principal only', () => {
    expect(resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 8_000,
      storedDonationAmount: 10_000,
      storedTipAmount: 0,
    })).toEqual({ donationAmountCents: 8_000, tipCents: 0 });
  });

  it('rejects unclassifiable overpayments when a complete split is known', () => {
    expect(() => resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 11_501,
      metadataDonationAmount: '10000',
      metadataTipAmount: '1500',
    })).toThrow('exceeds the configured donation and tip');
  });

  it('rejects renewals with no trustworthy principal source', () => {
    expect(() => resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 11_500,
    })).toThrow('principal could not be resolved');
  });

  it('always conserves the amount Stripe reports as paid', () => {
    const result = resolveRecurringRenewalAmounts({
      invoiceAmountPaid: 9_173,
      metadataDonationAmount: '10000',
      metadataTipAmount: '1500',
    });

    expect(result.donationAmountCents + result.tipCents).toBe(9_173);
  });
});
