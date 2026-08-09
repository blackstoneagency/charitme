import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  campaigns: [{
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'community-care',
    title: 'Community care',
    status: 'active',
    visibility: 'public',
    accept_donations: true,
    deadline: null,
    user_id: '11111111-1111-4111-8111-111111111111',
    beneficiary_profile_id: null,
  }],
  campaignError: null as { message: string } | null,
  payout: { stripeAccountId: 'acct_ready', recipientUserId: '11111111-1111-4111-8111-111111111111', role: 'organizer' as const } as {
    stripeAccountId: string;
    recipientUserId: string;
    role: 'organizer';
  } | null,
  payoutThrows: false,
}));

const createCheckoutSession = vi.hoisted(() => vi.fn(async () => ({
  id: 'cs_test_portfolio',
  url: 'https://checkout.stripe.test/portfolio',
})));
const checkoutPaymentMethodTypes = vi.hoisted(() => vi.fn(() => ['card']));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

vi.mock('../lib/rate-limit', () => ({ checkRateLimit: () => true }));
vi.mock('../lib/auth-config', () => ({ getAppOrigin: () => 'https://www.charitme.com' }));
vi.mock('../lib/stripe', () => ({ createCheckoutSession, checkoutPaymentMethodTypes }));
vi.mock('../lib/donation-checkout-settings', () => ({
  getDonationCheckoutSnapshot: async () => ({
    revision: 'revision-1',
    settings: {
      amountPresetsCents: [2_500, 5_000, 7_500, 10_000, 15_000, 25_000],
      popularAmountCents: 5_000,
      supportTierPercents: [15, 12, 10, 8, 5, 3, 1, 0],
      defaultSupportPercent: 15,
      methodFees: {
        stripe: { pct: 2.9, fixed: 30, label: '2.9% + $0.30' },
        gpay: { pct: 2.9, fixed: 30, label: '2.9% + $0.30' },
        bank: { pct: 0.8, fixed: 0, cap: 500, label: '0.8% (max $5)' },
        card: { pct: 2.9, fixed: 30, label: '2.9% + $0.30' },
      },
    },
  }),
}));

vi.mock('../lib/payout-destination', () => {
  class PayoutLookupUnavailableError extends Error {}
  return {
    PayoutLookupUnavailableError,
    resolvePayoutDestination: async () => {
      if (state.payoutThrows) throw new PayoutLookupUnavailableError('lookup failed');
      return state.payout;
    },
  };
});

vi.mock('../lib/supabase', () => {
  class CampaignQuery {
    select(): CampaignQuery { return this; }
    in(): CampaignQuery { return this; }
    async is(): Promise<{ data: typeof state.campaigns; error: typeof state.campaignError }> {
      return { data: state.campaigns, error: state.campaignError };
    }
  }

  return {
    supabaseAdmin: {
      from: () => new CampaignQuery(),
    },
  };
});

import { POST } from '../app/api/donations/portfolio/route';

function request(overrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/donations/portfolio', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'portfolio-test-key' },
    body: JSON.stringify({
      campaignIds: [CAMPAIGN_ID],
      totalCents: 5_000,
      tipPercent: 15,
      paymentMethod: 'stripe',
      checkoutRevision: 'revision-1',
      ...overrides,
    }),
  });
}

describe('portfolio donation checkout', () => {
  beforeEach(() => {
    state.campaignError = null;
    state.payout = {
      stripeAccountId: 'acct_ready',
      recipientUserId: USER_ID,
      role: 'organizer',
    };
    state.payoutThrows = false;
    createCheckoutSession.mockClear();
    checkoutPaymentMethodTypes.mockClear();
  });

  it('rejects a stale Super Admin pricing revision before creating checkout', async () => {
    const response = await POST(request({ checkoutRevision: 'stale' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CHECKOUT_CONFIG_CHANGED' });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('does not charge when a selected campaign has no payout-ready recipient', async () => {
    state.payout = null;
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PAYOUT_NOT_READY' });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns a retryable error when Supabase cannot verify payout readiness', async () => {
    state.payoutThrows = true;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'PAYOUT_LOOKUP_UNAVAILABLE' });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('uses configured support and processor fees in the Stripe session', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      url: 'https://checkout.stripe.test/portfolio',
      breakdown: { donationCents: 5_000, tipCents: 750, processingFeeCents: 197 },
    });
    expect(checkoutPaymentMethodTypes).toHaveBeenCalledWith('stripe', 'payment');
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 5_000 }) }),
          expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 750 }) }),
          expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 197 }) }),
        ]),
      }),
      expect.stringContaining('portfolio_guest_5000_'),
    );
  });
});
