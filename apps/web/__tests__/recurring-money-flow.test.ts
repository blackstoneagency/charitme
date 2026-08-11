import { describe, it, expect, vi, beforeEach } from 'vitest';
import { donorTip, DEFAULT_DONATION_CHECKOUT_SETTINGS } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING donations — the other route that takes donor money, and the one
// `donation-money-flow.test.ts` does not cover.
//
// The invariants are the same three (CharitMe never holds funds, CharitMe is
// paid the service fee, the recipient receives the donation), but the Stripe
// mechanics differ in a way that matters: a SUBSCRIPTION cannot carry
// `application_fee_amount`, so the fee is expressed as
// `application_fee_percent` derived from the tip. A percent is lossy where a
// fixed amount is not, so it is asserted against the actual arithmetic rather
// than eyeballed.
//
// ⚠️ Same limit as the one-off suite, measured rather than assumed: this
// sandbox has ZERO `STRIPE_*` environment variables and no `.env` file, while
// `api.stripe.com` answers 401 — the network works and the credentials simply do
// not exist. A live charge would need a key I do not have and must not
// fabricate, so end-to-end money movement stays owner-gated.
// ─────────────────────────────────────────────────────────────────────────────

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZER_ID = '22222222-2222-4222-8222-222222222222';
const ACCT = 'acct_recipient_live';
const state = vi.hoisted(() => ({
  captured: null as Record<string, unknown> | null,
  stripeCalls: 0,
  destination: null as null | { stripeAccountId: string; recipientUserId: string; role: string },
  destinationThrows: null as null | Error,
}));

vi.mock('server-only', () => ({}));

vi.mock('../lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/stripe')>();
  return {
    ...actual,
    createCheckoutSession: async (params: Record<string, unknown>) => {
      state.stripeCalls += 1;
      state.captured = params;
      return { id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' };
    },
  };
});

vi.mock('../lib/payout-destination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/payout-destination')>();
  return {
    ...actual,
    resolvePayoutDestination: async () => {
      if (state.destinationThrows) throw state.destinationThrows;
      return state.destination;
    },
  };
});

// A campaign that is live, donatable, and owned by ORGANIZER_ID.
const CAMPAIGN_ROW = {
  id: CAMPAIGN_ID,
  user_id: ORGANIZER_ID,
  slug: 'help-the-team',
  title: 'Help the team',
  status: 'active',
  accept_donations: true,
  deadline: null,
  currency: 'usd',
  beneficiary_profile_id: null,
  visibility: 'public',
  deleted_at: null,
};

vi.mock('../lib/supabase', () => {
  const builder = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: CAMPAIGN_ROW, error: null, count: 0 }).then(resolve),
      maybeSingle: async () => ({ data: CAMPAIGN_ROW, error: null }),
      single: async () => ({ data: CAMPAIGN_ROW, error: null }),
    };
    return new Proxy(chain, {
      get(t, prop) {
        if (prop in t) return t[prop as string];
        if (typeof prop === 'symbol') return undefined;
        return () => builder();
      },
    });
  };
  return { supabaseAdmin: { from: () => builder(), rpc: async () => ({ data: null, error: null }) } };
});

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock('../lib/roles', () => ({ getSuspensionState: async () => 'active' }));
vi.mock('../lib/rate-limit', () => ({ checkRateLimit: () => true }));
// `getDonationCheckoutSnapshot` wraps Next's `unstable_cache`, which throws
// outside a request context. The DEFAULTS are used so the fee arithmetic under
// test is the real shipped configuration, not numbers invented here.
vi.mock('../lib/donation-checkout-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/donation-checkout-settings')>();
  const { DEFAULT_DONATION_CHECKOUT_SETTINGS } = await import('@shared/fees');
  return {
    ...actual,
    getDonationCheckoutSnapshot: async () => ({
      settings: DEFAULT_DONATION_CHECKOUT_SETTINGS,
      revision: 'test-revision',
    }),
  };
});

vi.mock('../lib/marketing-engine', () => ({
  resolveContact: async () => null,
  trackEvent: async () => undefined,
}));

beforeEach(() => {
  state.captured = null;
  state.stripeCalls = 0;
  state.destinationThrows = null;
  state.destination = { stripeAccountId: ACCT, recipientUserId: ORGANIZER_ID, role: 'organizer' };
});


async function subscribe(payload: Record<string, unknown>) {
  const { POST } = await import('../app/api/donations/recurring/route');
  const res = await POST(new Request('http://localhost/api/donations/recurring', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campaignId: CAMPAIGN_ID, donorEmail: 'donor@example.test', ...payload }),
  }) as never);
  return res as Response;
}

/** The subscription params Stripe would receive. */
function subscriptionData() {
  expect(state.captured, 'no Stripe session was created').not.toBeNull();
  const sd = (state.captured as Record<string, Record<string, unknown>>).subscription_data;
  expect(sd, 'subscription_data missing — the money routing lives here').toBeDefined();
  return sd;
}

describe('recurring gifts route straight to the recipient', () => {
  it('is a destination charge on every cycle', async () => {
    await subscribe({ amountCents: 5_000, cadence: 'monthly' });
    expect(subscriptionData().transfer_data).toEqual({ destination: ACCT });
  });

  it('refuses to start a subscription with nowhere to send the money', async () => {
    state.destination = null;
    const res = await subscribe({ amountCents: 5_000 });
    expect(res.status).toBe(409);
    expect(state.stripeCalls, 'a recurring charge was set up with no destination').toBe(0);
  });

  it('declines rather than guessing when readiness cannot be DETERMINED', async () => {
    const { PayoutLookupUnavailableError } = await import('../lib/payout-destination');
    state.destinationThrows = new PayoutLookupUnavailableError('timeout');
    const res = await subscribe({ amountCents: 5_000 });
    expect(res.status).toBe(503);
    expect(state.stripeCalls).toBe(0);
  });
});

describe('the service fee survives the percent conversion', () => {
  it('charges a percent that reproduces the tip', async () => {
    const amount = 5_000;
    const tipPercent = DEFAULT_DONATION_CHECKOUT_SETTINGS.defaultSupportPercent;
    await subscribe({ amountCents: amount, tipPercent, cadence: 'monthly' });

    const tip = donorTip(amount, tipPercent);
    const total = amount + tip;
    const pct = subscriptionData().application_fee_percent as number;

    // The route rounds to 2dp, which is what Stripe accepts. Applying the
    // rounded percent back to the total must land on the tip to within a cent —
    // if it did not, CharitMe would be paid a different amount than the donor
    // was shown.
    expect(Math.abs(Math.round((pct / 100) * total) - tip)).toBeLessThanOrEqual(1);
  });

  it('takes NO fee when the donor declines it', async () => {
    // `undefined`, not 0: Stripe treats an explicit 0 differently from an absent
    // field, and sending 0 would still mark the subscription as fee-bearing.
    await subscribe({ amountCents: 5_000, tipPercent: 0, cadence: 'monthly' });
    expect(subscriptionData().application_fee_percent).toBeUndefined();
  });

  it('never takes more than the tip', async () => {
    // The recipient must keep the donation itself on every cycle.
    const amount = 5_000;
    const tipPercent = 10;
    await subscribe({ amountCents: amount, tipPercent, cadence: 'monthly' });

    const tip = donorTip(amount, tipPercent);
    const pct = subscriptionData().application_fee_percent as number;
    const feeCents = Math.round((pct / 100) * (amount + tip));
    expect(feeCents).toBeLessThanOrEqual(tip + 1);
  });
});

describe('every cadence and method keeps the guarantees', () => {
  it.each([['monthly'], ['weekly'], ['quarterly'], ['annual']])('%s', async (cadence) => {
    await subscribe({ amountCents: 5_000, cadence, tipPercent: 10 });
    expect(subscriptionData().transfer_data).toEqual({ destination: ACCT });
  });

  it.each([['stripe'], ['card'], ['gpay'], ['bank']])('%s', async (paymentMethod) => {
    await subscribe({ amountCents: 5_000, cadence: 'monthly', tipPercent: 10, paymentMethod });
    expect(subscriptionData().transfer_data).toEqual({ destination: ACCT });
  });
});
