import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventTicketFee, EVENT_TICKET_FEE_PERCENT } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events/[id]/tickets/checkout — the money invariants, by EXECUTING it.
//
// ⚠️ THIS ROUTE USED TO COLLECT NOTHING. It set `transfer_data.destination`, so
// the organizer was paid correctly, but no `application_fee_amount` — CharitMe
// took no commission on a ticket sale AND still absorbed Stripe's processing
// cost on it, so every ticket sold lost the platform money. It now takes
// EVENT_TICKET_FEE_PERCENT.
//
// A ticket is a PURCHASE, not a donation: the buyer receives admission, there is
// no optional-support prompt, and the commission is not reducible by the buyer.
// That is why it is a flat percentage here rather than the tip + processing
// arithmetic the donation routes use.
//
// The invariant that does NOT change: this is a destination charge, so the
// organizer receives (total − fee) directly and CharitMe never holds the sale.
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_ID = '55555555-5555-4555-8555-555555555555';
const TICKET_ID = '66666666-6666-4666-8666-666666666666';
const REQUEST_KEY = '77777777-7777-4777-8777-777777777777';
const ORGANIZER_ID = 'organizer-9';
const ACCT = 'acct_event_organizer';

const state = vi.hoisted(() => ({
  captured: null as Record<string, unknown> | null,
  stripeCalls: 0,
  destination: null as null | { stripeAccountId: string; recipientUserId: string; role: string },
  destinationThrows: null as null | Error,
  user: { id: 'buyer-1', email: 'buyer@example.test' } as { id: string; email: string } | null,
  price: 5_000,
  quantity: 2,
  released: [] as string[],
}));

vi.mock('server-only', () => ({}));

vi.mock('../lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/stripe')>();
  return {
    ...actual,
    stripe: { checkout: { sessions: { expire: async () => ({}) } } },
    createCheckoutSession: async (params: Record<string, unknown>) => {
      state.stripeCalls += 1;
      state.captured = params;
      return { id: 'cs_test_t1', url: 'https://checkout.stripe.test/cs_test_t1' };
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

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: async () => true }));

vi.mock('../lib/supabase', () => {
  const rowFor = (table: string) => {
    if (table === 'fundraising_events') {
      return { id: EVENT_ID, title: 'Gala', slug: 'gala', status: 'published', starts_at: null, ends_at: null, created_by: ORGANIZER_ID, campaign_id: null };
    }
    return { id: TICKET_ID, event_id: EVENT_ID, title: 'General admission', price_cents: state.price, quantity_limit: 100, sold_count: 0 };
  };
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rowFor(table), error: null }).then(resolve),
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
  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (fn: string) => {
        if (fn === 'reserve_event_ticket') {
          return {
            data: [{
              registration_id: 'reg-1',
              unit_price_cents: state.price,
              total_cents: state.price * state.quantity,
              currency: 'usd',
            }],
            error: null,
          };
        }
        if (fn === 'attach_event_ticket_checkout') return { data: true, error: null };
        if (fn === 'release_event_ticket_reservation') { state.released.push('released'); return { data: true, error: null }; }
        return { data: null, error: null };
      },
    },
  };
});

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));

beforeEach(() => {
  state.captured = null;
  state.stripeCalls = 0;
  state.destinationThrows = null;
  state.released = [];
  state.price = 5_000;
  state.quantity = 2;
  state.user = { id: 'buyer-1', email: 'buyer@example.test' };
  state.destination = { stripeAccountId: ACCT, recipientUserId: ORGANIZER_ID, role: 'organizer' };
});

async function buy(body: Record<string, unknown> = {}) {
  const { POST } = await import('../app/api/events/[id]/tickets/checkout/route');
  return (await POST(
    new Request(`http://localhost/api/events/${EVENT_ID}/tickets/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticket_id: TICKET_ID, quantity: state.quantity, request_key: REQUEST_KEY, ...body }),
    }) as never,
    { params: Promise.resolve({ id: EVENT_ID }) } as never,
  )) as Response;
}

function charge() {
  expect(state.captured, 'no Stripe session was created').not.toBeNull();
  const pi = (state.captured as Record<string, Record<string, unknown>>).payment_intent_data;
  expect(pi, 'payment_intent_data missing — the money routing lives here').toBeDefined();
  return pi;
}

function totalCharged(): number {
  const items = (state.captured as Record<string, unknown>).line_items as Array<{
    price_data: { unit_amount: number }; quantity: number;
  }>;
  return items.reduce((sum, i) => sum + i.price_data.unit_amount * i.quantity, 0);
}

describe('CharitMe is paid its commission on a ticket sale', () => {
  it(`takes ${EVENT_TICKET_FEE_PERCENT}% of the sale as the application fee`, async () => {
    await buy();

    const total = 5_000 * 2;
    expect(charge().application_fee_amount).toBe(eventTicketFee(total));
    expect(charge().application_fee_amount).toBe(1_000); // 10% of $100.00
  });

  it('charges on the WHOLE order, not on one ticket', async () => {
    // The fee is computed from the reservation total. Computing it per unit and
    // forgetting the quantity would undercharge every multi-ticket order.
    state.quantity = 4;
    await buy();

    expect(totalCharged()).toBe(5_000 * 4);
    expect(charge().application_fee_amount).toBe(eventTicketFee(5_000 * 4));
  });

  it('used to take NOTHING — the fee must actually be present', async () => {
    await buy();

    expect(charge().application_fee_amount, 'the route collected no commission before this')
      .toBeGreaterThan(0);
  });
});

describe('the organizer still receives the rest, directly', () => {
  it('is a destination charge to the organizer', async () => {
    await buy();

    expect(charge().transfer_data).toEqual({ destination: ACCT });
  });

  it('nets the organizer exactly total − fee, with nothing unaccounted for', async () => {
    await buy();

    const fee = charge().application_fee_amount as number;
    const net = totalCharged() - fee;
    expect(net + fee).toBe(totalCharged());
    expect(net).toBe(totalCharged() - eventTicketFee(totalCharged()));
  });

  it('refuses to sell when there is nowhere to send the money', async () => {
    state.destination = null;

    const res = await buy();

    expect(res.status).toBe(409);
    expect(state.stripeCalls, 'a ticket was sold with no payout destination').toBe(0);
  });

  it('declines rather than guessing when readiness cannot be determined', async () => {
    const { PayoutLookupUnavailableError } = await import('../lib/payout-destination');
    state.destinationThrows = new PayoutLookupUnavailableError('timeout');

    const res = await buy();

    expect(res.status).toBe(503);
    expect(state.stripeCalls).toBe(0);
  });
});

describe('the fee arithmetic itself', () => {
  it('rounds to the nearest cent', () => {
    // 10% of 1055 is 105.5 → 106, not 105 (floor) and not 0.
    expect(eventTicketFee(1_055)).toBe(106);
  });

  it('never exceeds the sale, whatever the rate', () => {
    // A fee larger than the charge makes Stripe reject the payment outright.
    //
    // ⚠️ The rate is passed in HERE rather than relying on the shipped 10%,
    // because at 10% the clamp can never bind and an earlier version of this
    // test proved nothing: a mutation deleting the clamp passed it. A rate above
    // 100 is the only input that exercises the guard.
    expect(eventTicketFee(10_000, 150)).toBe(10_000);
    expect(eventTicketFee(1, 999)).toBe(1);
  });

  it('never goes negative', () => {
    expect(eventTicketFee(0)).toBe(0);
    expect(eventTicketFee(-500)).toBe(0);
    expect(eventTicketFee(10_000, -10)).toBe(0);
  });

  it('is 0 for a free ticket rather than a rounding artefact', () => {
    expect(eventTicketFee(0)).toBe(0);
  });

  it('handles a non-finite total without producing NaN into Stripe', () => {
    // `NaN` as an application_fee_amount is a 400 from Stripe at best and a
    // silently wrong split at worst.
    expect(eventTicketFee(Number.NaN)).toBe(0);
    expect(eventTicketFee(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('the sale is attributable', () => {
  it('records the commission in metadata so the webhook and audit agree', async () => {
    await buy();

    const meta = (state.captured as Record<string, Record<string, string>>).metadata;
    expect(meta.type).toBe('event_ticket');
    expect(meta.platformFeeCents).toBe(String(eventTicketFee(10_000)));
  });
});
