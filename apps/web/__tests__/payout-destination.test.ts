import { describe, expect, it } from 'vitest';
import { accountIsPayoutReady } from '../lib/payout-destination';

// Money-flow test #1: a connected recipient account must be fully ready before
// a campaign can accept live donations. Anything less keeps donations blocked
// so funds never land in CharitMe's platform balance while the recipient
// finishes payout setup. See docs/payments/money-flow.md.
describe('accountIsPayoutReady', () => {
  const ready = {
    stripe_account_id: 'acct_123',
    details_submitted: true,
    payouts_enabled: true,
    charges_enabled: true,
  };

  it('is true only when the account exists and charges + payouts are enabled', () => {
    expect(accountIsPayoutReady(ready)).toBe(true);
  });

  it('is false when there is no connected account at all', () => {
    expect(accountIsPayoutReady(null)).toBe(false);
    expect(accountIsPayoutReady(undefined)).toBe(false);
    expect(accountIsPayoutReady({ ...ready, stripe_account_id: null })).toBe(false);
    expect(accountIsPayoutReady({ ...ready, stripe_account_id: '' })).toBe(false);
  });

  it('is false when onboarding details are not submitted', () => {
    expect(accountIsPayoutReady({ ...ready, details_submitted: false })).toBe(false);
    expect(accountIsPayoutReady({ ...ready, details_submitted: null })).toBe(false);
  });

  it('is false when charges are not enabled (cannot take a destination charge)', () => {
    expect(accountIsPayoutReady({ ...ready, charges_enabled: false })).toBe(false);
    expect(accountIsPayoutReady({ ...ready, charges_enabled: null })).toBe(false);
  });

  it('is false when payouts are not enabled (recipient could not be paid)', () => {
    expect(accountIsPayoutReady({ ...ready, payouts_enabled: false })).toBe(false);
    expect(accountIsPayoutReady({ ...ready, payouts_enabled: null })).toBe(false);
  });

  it('requires ALL conditions — a single missing flag blocks donations', () => {
    const flags: (keyof typeof ready)[] = ['details_submitted', 'payouts_enabled', 'charges_enabled'];
    for (const flag of flags) {
      expect(accountIsPayoutReady({ ...ready, [flag]: false })).toBe(false);
    }
  });
});
