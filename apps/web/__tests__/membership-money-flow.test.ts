import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/creators/tiers/subscribe — the money invariants, by EXECUTING it.
//
// A membership is recurring income belonging to the CREATOR, so it is subject to
// the same promise as a donation: CharitMe never holds it. `money-routing-
// inventory` proves this route is classified and carries a destination; this
// proves the destination is the right account, that nothing is skimmed, and that
// the two "cannot pay out" cases are answered differently.
//
// ⚠️ The distinction that had no coverage, and that this route got wrong:
// `resolvePayoutDestination` returning `null` ("this creator has not onboarded")
// and THROWING `PayoutLookupUnavailableError` ("we could not check") are
// different facts. The throw was unhandled, so a lookup failure surfaced as a
// generic 500. No money moved — it fails safe — but a retryable outage was
// reported to the supporter as an unexplained error, and to any client parsing
// `code` as nothing at all.
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_ID = 'member-1';
const CREATOR_USER_ID = 'creator-user-1';
const TIER_ID = '44444444-4444-4444-8444-444444444444';
const ACCT = 'acct_creator_live';

const state = vi.hoisted(() => ({
  captured: null as Record<string, unknown> | null,
  stripeCalls: 0,
  destination: null as null | { stripeAccountId: string; recipientUserId: string; role: string },
  destinationThrows: null as null | Error,
  user: { id: 'member-1', email: 'member@example.test' } as { id: string; email: string } | null,
  tier: {} as Record<string, unknown>,
}));

vi.mock('server-only', () => ({}));

vi.mock('../lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/stripe')>();
  return {
    ...actual,
    createCheckoutSession: async (params: Record<string, unknown>) => {
      state.stripeCalls += 1;
      state.captured = params;
      return { id: 'cs_test_m1', url: 'https://checkout.stripe.test/cs_test_m1' };
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

const CREATOR_ROW = {
  id: 'creator-profile-1',
  handle: 'ada',
  display_name: 'Ada',
  user_id: CREATOR_USER_ID,
};

vi.mock('../lib/supabase', () => {
  const rowFor = (table: string) =>
    table === 'membership_tiers' ? state.tier : CREATOR_ROW;
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rowFor(table), error: null }).then(resolve),
      maybeSingle: async () => ({ data: rowFor(table), error: null }),
      single: async () => ({ data: rowFor(table), error: null }),
    };
    return new Proxy(chain, {
      get(t, prop) {
        if (prop in t) return t[prop as string];
        if (typeof prop === 'symbol') return undefined;
        return () => builder(table);
      },
    });
  };
  return { supabaseAdmin: { from: (table: string) => builder(table) } };
});

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock('../lib/rate-limit', () => ({ checkRateLimit: () => true }));

beforeEach(() => {
  state.captured = null;
  state.stripeCalls = 0;
  state.destinationThrows = null;
  state.user = { id: MEMBER_ID, email: 'member@example.test' };
  state.destination = { stripeAccountId: ACCT, recipientUserId: CREATOR_USER_ID, role: 'organizer' };
  state.tier = {
    id: TIER_ID,
    title: 'Supporter',
    description: 'Members-only posts',
    amount_cents: 1_200,
    interval: 'month',
    active: true,
    creator_profile_id: CREATOR_ROW.id,
  };
});

async function subscribe(body: Record<string, unknown> = {}) {
  const { POST } = await import('../app/api/creators/tiers/subscribe/route');
  return (await POST(new Request('http://localhost/api/creators/tiers/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tierId: TIER_ID, ...body }),
  }) as never)) as Response;
}

function session() {
  expect(state.captured, 'no Stripe session was created').not.toBeNull();
  return state.captured as Record<string, Record<string, unknown>>;
}

describe('the creator is paid, not CharitMe', () => {
  it('routes the subscription to the creator\'s connected account', async () => {
    await subscribe();

    // On a subscription the destination lives under `subscription_data`, not
    // `payment_intent_data` — a detail worth pinning, because putting it in the
    // wrong place is silently accepted for the first invoice shape and leaves
    // every renewal on the platform balance.
    expect(session().subscription_data.transfer_data).toEqual({ destination: ACCT });
  });

  it('takes no application fee — the creator receives the whole membership', async () => {
    await subscribe();

    const sub = session().subscription_data;
    expect(sub.application_fee_percent, 'CharitMe takes no cut of a membership').toBeUndefined();
    expect(session().application_fee_amount).toBeUndefined();
  });

  it('charges the tier price, in subscription mode, on the tier\'s interval', async () => {
    await subscribe();

    const items = session().line_items as unknown as Array<{
      price_data: { unit_amount: number; recurring: { interval: string } };
    }>;
    expect(session().mode).toBe('subscription');
    expect(items[0].price_data.unit_amount).toBe(1_200);
    expect(items[0].price_data.recurring.interval).toBe('month');
  });

  it('maps a human interval spelling to a Stripe one', async () => {
    // `yearly` is what the tier editor stores; Stripe only accepts `year`.
    state.tier = { ...state.tier, interval: 'yearly' };
    await subscribe();

    const items = session().line_items as unknown as Array<{ price_data: { recurring: { interval: string } } }>;
    expect(items[0].price_data.recurring.interval).toBe('year');
  });
});

describe('it will not take recurring money it cannot forward', () => {
  it('declines with PAYOUT_NOT_READY when the creator has not onboarded', async () => {
    state.destination = null;

    const res = await subscribe();

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('PAYOUT_NOT_READY');
    expect(state.stripeCalls, 'a subscription was created with nowhere to send it').toBe(0);
  });

  it('answers 503 PAYOUT_LOOKUP_UNAVAILABLE when readiness cannot be CHECKED', async () => {
    // ⚠️ The case this route did not handle. It must not be reported as 409
    // "this creator has not onboarded" — that is a claim about the creator, made
    // on the strength of a failed query — nor escape as an unhandled 500.
    const { PayoutLookupUnavailableError } = await import('../lib/payout-destination');
    state.destinationThrows = new PayoutLookupUnavailableError('timeout');

    const res = await subscribe();

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('PAYOUT_LOOKUP_UNAVAILABLE');
    expect(state.stripeCalls).toBe(0);
  });

  it('does not swallow unrelated errors as a payout problem', async () => {
    // The catch must be narrow. Reporting any failure as "retry the payout
    // lookup" would hide real bugs behind a plausible 503.
    state.destinationThrows = new TypeError('bug in the resolver');

    await expect(subscribe()).rejects.toThrow('bug in the resolver');
    expect(state.stripeCalls).toBe(0);
  });
});

describe('the membership is attributable', () => {
  it('tags the session AND the subscription so the webhook cannot confuse it', async () => {
    await subscribe();

    // Both, deliberately: the session metadata drives `checkout.session.completed`
    // and the subscription metadata drives every later invoice event. Without
    // `kind` on the subscription, a renewal is indistinguishable from a recurring
    // donation and the handler writes the wrong table.
    expect(session().metadata.kind).toBe('membership');
    expect((session().subscription_data.metadata as Record<string, string>).kind).toBe('membership');
    expect(session().metadata.memberId).toBe(MEMBER_ID);
    expect(session().metadata.tierId).toBe(TIER_ID);
  });

  it('requires an account, because access has to attach to someone', async () => {
    state.user = null;

    const res = await subscribe();

    expect(res.status).toBe(401);
    expect(state.stripeCalls).toBe(0);
  });

  it('refuses a retired tier', async () => {
    state.tier = { ...state.tier, active: false };

    const res = await subscribe();

    expect(res.status).toBe(400);
    expect(state.stripeCalls).toBe(0);
  });
});
