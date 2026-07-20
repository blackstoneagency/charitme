import { describe, expect, it } from 'vitest';
import {
  transfersActive,
  onboardingComplete,
  deriveAccountStatus,
  type RecipientAccountShape,
} from '../lib/connect-sample/status';
import { applicationFeeCents, APPLICATION_FEE_PERCENT } from '../lib/connect-sample/client';

// The Connect V2 sample derives two payout/onboarding booleans from the live
// Stripe account, and takes a platform application fee on each destination
// charge. Both are pure and must be exactly right — a false "ready" would let a
// storefront take money an account can't receive, and a wrong fee misroutes
// funds. These lock the behaviour without hitting Stripe.

describe('transfersActive', () => {
  const active: RecipientAccountShape = {
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } },
  };

  it('is true only when the stripe_transfers capability is active', () => {
    expect(transfersActive(active)).toBe(true);
  });

  it('is false for any non-active status', () => {
    for (const status of ['pending', 'inactive', 'restricted', 'unrequested', '']) {
      expect(
        transfersActive({
          configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status } } } } },
        }),
      ).toBe(false);
    }
  });

  it('is false when the capability chain is absent, null, or the account is missing', () => {
    expect(transfersActive(null)).toBe(false);
    expect(transfersActive(undefined)).toBe(false);
    expect(transfersActive({})).toBe(false);
    expect(transfersActive({ configuration: null })).toBe(false);
    expect(transfersActive({ configuration: { recipient: null } })).toBe(false);
    expect(transfersActive({ configuration: { recipient: { capabilities: { stripe_balance: null } } } })).toBe(false);
    expect(
      transfersActive({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: null } } } } }),
    ).toBe(false);
  });
});

describe('onboardingComplete', () => {
  it('is false while requirements are currently or past due', () => {
    expect(onboardingComplete('currently_due')).toBe(false);
    expect(onboardingComplete('past_due')).toBe(false);
  });

  it('is true when nothing is outstanding (null/undefined) or a non-blocking status', () => {
    expect(onboardingComplete(null)).toBe(true);
    expect(onboardingComplete(undefined)).toBe(true);
    expect(onboardingComplete('eventually_due')).toBe(true);
    expect(onboardingComplete('pending')).toBe(true);
  });
});

describe('deriveAccountStatus', () => {
  it('reports ready + complete for an active account with no outstanding requirements', () => {
    const account: RecipientAccountShape = {
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } },
    };
    expect(deriveAccountStatus(account)).toEqual({
      readyToReceivePayments: true,
      onboardingComplete: true,
      requirementsStatus: null,
    });
  });

  it('can be active for transfers yet still have onboarding due', () => {
    const account: RecipientAccountShape = {
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } },
      requirements: { summary: { minimum_deadline: { status: 'currently_due' } } },
    };
    expect(deriveAccountStatus(account)).toEqual({
      readyToReceivePayments: true,
      onboardingComplete: false,
      requirementsStatus: 'currently_due',
    });
  });

  it('reports not-ready + incomplete when transfers are inactive and requirements are past due', () => {
    const account: RecipientAccountShape = {
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'inactive' } } } } },
      requirements: { summary: { minimum_deadline: { status: 'past_due' } } },
    };
    expect(deriveAccountStatus(account)).toEqual({
      readyToReceivePayments: false,
      onboardingComplete: false,
      requirementsStatus: 'past_due',
    });
  });

  it('treats an empty account as not-ready but with onboarding complete (nothing due)', () => {
    expect(deriveAccountStatus({})).toEqual({
      readyToReceivePayments: false,
      onboardingComplete: true,
      requirementsStatus: null,
    });
    expect(deriveAccountStatus(null)).toEqual({
      readyToReceivePayments: false,
      onboardingComplete: true,
      requirementsStatus: null,
    });
  });
});

describe('applicationFeeCents', () => {
  it('takes a flat 5% of the charge', () => {
    expect(APPLICATION_FEE_PERCENT).toBe(5);
    expect(applicationFeeCents(10000)).toBe(500); // $100.00 → $5.00
    expect(applicationFeeCents(2000)).toBe(100); // $20.00 → $1.00
  });

  it('rounds to the nearest cent', () => {
    expect(applicationFeeCents(999)).toBe(50); // 49.95 → 50
    expect(applicationFeeCents(9)).toBe(0); // 0.45 → 0
    expect(applicationFeeCents(10)).toBe(1); // 0.50 → 1
  });

  it('is zero for a zero-amount charge', () => {
    expect(applicationFeeCents(0)).toBe(0);
  });
});
