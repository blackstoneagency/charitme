import { describe, it, expect, vi, beforeEach } from 'vitest';
import { donorTip, methodProcessingFee, DEFAULT_DONATION_CHECKOUT_SETTINGS } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// THE MONEY INVARIANTS, proved by EXECUTING /api/donations.
//
// Three promises are made to donors and organizers on the public site:
//   1. CharitMe never holds donation funds.
//   2. CharitMe is paid the optional service fee (plus a processing offset).
//   3. The recipient receives 100% of the donation.
//
// All three are properties of ONE Stripe object — the params handed to
// `createCheckoutSession` — and before this file NOTHING asserted them.
// `donation-guest-flow.test.ts` looks like coverage but rebuilds the metadata
// shape locally and never runs the route; its only mention of
// `application_fee_amount` is a comment.
//
// ⚠️ WHAT THIS CANNOT DO: it cannot move real money. There are no Stripe test
// keys in this sandbox and using production credentials in a test is forbidden,
// so a live charge → transfer → payout is out of reach here and stays owner-
// gated. What it CAN do is pin the exact request that would be sent, which is
// where every one of these invariants is decided.
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

async function donate(body: Record<string, unknown>) {
  const { POST } = await import('../app/api/donations/route');
  const res = await POST(new Request('http://localhost/api/donations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campaignId: CAMPAIGN_ID, email: 'donor@example.test', ...body }),
  }) as never);
  return res as Response;
}

/** The Stripe params actually handed to createCheckoutSession. */
function charge() {
  expect(state.captured, 'no Stripe session was created').not.toBeNull();
  const pi = (state.captured as Record<string, Record<string, unknown>>).payment_intent_data;
  expect(pi, 'payment_intent_data missing — the money routing lives here').toBeDefined();
  return pi;
}

/** Everything the donor is charged, summed from the line items. */
function totalCharged(): number {
  const items = (state.captured as Record<string, unknown>).line_items as Array<{
    price_data: { unit_amount: number }; quantity: number;
  }>;
  return items.reduce((sum, i) => sum + i.price_data.unit_amount * i.quantity, 0);
}

describe('CharitMe never holds the funds', () => {
  it('sends a DESTINATION charge — the money goes straight to the recipient', async () => {
    await donate({ amountCents: 5_000, tipPercent: 10, coverProcessingFee: true });

    // `transfer_data.destination` is what makes this a destination charge:
    // Stripe moves the funds to the connected account at capture, so they never
    // sit in CharitMe's balance. Without it the charge lands on the platform and
    // CharitMe holds the money until it transfers it out — which is exactly the
    // arrangement the product promises it does not use.
    expect(charge().transfer_data).toEqual({ destination: ACCT });
  });

  it('never falls back to a platform charge when payout setup is incomplete', async () => {
    state.destination = null;
    const res = await donate({ amountCents: 5_000 });

    expect(res.status).toBe(409);
    expect(state.stripeCalls, 'a charge was created with nowhere to send the money').toBe(0);
  });

  it('declines rather than guessing when readiness cannot be DETERMINED', async () => {
    // "Could not check" is not "not set up". Paying the wrong person is
    // unrecoverable; declining is not.
    const { PayoutLookupUnavailableError } = await import('../lib/payout-destination');
    state.destinationThrows = new PayoutLookupUnavailableError('timeout');

    const res = await donate({ amountCents: 5_000 });

    expect(res.status).toBe(503);
    expect(state.stripeCalls).toBe(0);
  });

  it('pays the BENEFICIARY when the campaign has one', async () => {
    const BENEFICIARY = '33333333-3333-4333-8333-333333333333';
    state.destination = { stripeAccountId: 'acct_beneficiary', recipientUserId: BENEFICIARY, role: 'beneficiary' };

    await donate({ amountCents: 5_000 });

    expect(charge().transfer_data).toEqual({ destination: 'acct_beneficiary' });
    const meta = (state.captured as Record<string, Record<string, string>>).metadata;
    expect(meta.payoutRecipientId).toBe(BENEFICIARY);
    expect(meta.payoutRole).toBe('beneficiary');
  });
});

describe('CharitMe is paid the service fee, and only the service fee', () => {
  it('takes exactly tip + processing as the application fee', async () => {
    const amount = 5_000;
    const tipPercent = 10;
    await donate({ amountCents: amount, tipPercent, coverProcessingFee: true });

    const tip = donorTip(amount, tipPercent);
    const processing = methodProcessingFee(amount + tip, 'stripe', DEFAULT_DONATION_CHECKOUT_SETTINGS.methodFees);
    expect(charge().application_fee_amount).toBe(tip + processing);
  });

  it('takes NOTHING beyond the fee — the recipient nets the full donation', async () => {
    // The invariant that matters most, expressed the way Stripe settles it:
    // on a destination charge the connected account receives
    // (total charged − application_fee_amount).
    const amount = 5_000;
    await donate({ amountCents: amount, tipPercent: 10, coverProcessingFee: true });

    const netToRecipient = totalCharged() - (charge().application_fee_amount as number);
    expect(netToRecipient, 'the recipient must receive 100% of the donation').toBe(amount);
  });

  it('holds when the donor declines the optional fee entirely', async () => {
    // 0% support is one click away, and it must not quietly break the split:
    // CharitMe then keeps only the processing offset, and the recipient still
    // receives the whole donation.
    const amount = 5_000;
    await donate({ amountCents: amount, tipPercent: 0, coverProcessingFee: true });

    const fee = charge().application_fee_amount as number;
    expect(fee).toBe(methodProcessingFee(amount, 'stripe', DEFAULT_DONATION_CHECKOUT_SETTINGS.methodFees));
    expect(totalCharged() - fee).toBe(amount);
  });

  it('records the split in metadata, so the webhook and audit agree', async () => {
    const amount = 5_000;
    await donate({ amountCents: amount, tipPercent: 10, coverProcessingFee: true });

    const meta = (state.captured as Record<string, Record<string, string>>).metadata;
    const tip = donorTip(amount, 10);
    expect(meta.donationAmountCents).toBe(String(amount));
    expect(meta.tipCents).toBe(String(tip));
    // `platformFeeCents` is CharitMe's REVENUE — the tip alone. The processing
    // component is an offset for Stripe's deduction, not income, and counting it
    // as revenue would overstate what CharitMe earns.
    expect(meta.platformFeeCents).toBe(String(tip));
    expect(meta.connectedAccountId).toBe(ACCT);
  });
});

describe('every payment method keeps the same guarantees', () => {
  // The processing fee differs per method — bank transfer is 0.8% capped at $5
  // — so the amounts change while the invariants must not.
  // ⚠️ The field is `paymentMethod`. An earlier draft of this file sent `method`,
  // which the schema ignores — so every case silently fell back to 'stripe' and
  // the bank-cap assertion failed against a 2.9% fee. The test was wrong, not the
  // route; a mis-named field here would have made this whole block vacuous.
  it.each([['stripe'], ['card'], ['gpay'], ['bank']])('%s', async (method) => {
    const amount = 100_000; // $1,000: large enough for the bank cap to bind
    await donate({ amountCents: amount, tipPercent: 10, coverProcessingFee: true, paymentMethod: method });

    const c = charge();
    expect(c.transfer_data, `${method} must still be a destination charge`).toEqual({ destination: ACCT });
    expect(
      totalCharged() - (c.application_fee_amount as number),
      `${method} must still net the recipient the full donation`,
    ).toBe(amount);
  });

  it('honours the bank-transfer cap rather than charging a percentage', async () => {
    const amount = 100_000;
    await donate({ amountCents: amount, tipPercent: 0, coverProcessingFee: true, paymentMethod: 'bank' });

    // 0.8% of $1,000 would be $8.00; the cap is $5.00.
    expect(charge().application_fee_amount).toBe(500);
  });
});
