import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type DbError = { code?: string; message: string } | null;
type DbResult = { data: unknown; error: DbError };

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const TICKET_ID = '33333333-3333-4333-8333-333333333333';
const REGISTRATION_ID = '44444444-4444-4444-8444-444444444444';
const REQUEST_KEY = '55555555-5555-4555-8555-555555555555';

const state = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'attendee@example.test' } as { id: string; email: string } | null,
  rateAllowed: true,
  event: {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Community Gala',
    slug: 'community-gala',
    status: 'published',
    starts_at: '2026-12-01T18:00:00.000Z',
    ends_at: null,
    created_by: '66666666-6666-4666-8666-666666666666',
    campaign_id: null,
  } as Record<string, unknown> | null,
  ticket: {
    id: '33333333-3333-4333-8333-333333333333',
    event_id: '22222222-2222-4222-8222-222222222222',
    title: 'General admission',
    price_cents: 2500,
    quantity_limit: 100,
    sold_count: 0,
  } as Record<string, unknown> | null,
  destination: {
    stripeAccountId: 'acct_test',
    recipientUserId: '66666666-6666-4666-8666-666666666666',
    role: 'organizer' as const,
  } as { stripeAccountId: string; recipientUserId: string; role: 'organizer' } | null,
  reserveError: null as DbError,
}));

const rateLimit = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.rateAllowed));
const createCheckout = vi.hoisted(() => vi.fn(async () => ({ id: 'cs_test_event', url: 'https://checkout.stripe.test/event', payment_status: 'unpaid' })));
const expireCheckout = vi.hoisted(() => vi.fn(async () => ({ id: 'cs_test_event' })));
const resolveDestination = vi.hoisted(() => vi.fn(async () => state.destination));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: rateLimit }));
vi.mock('../lib/auth-config', () => ({ getAppOrigin: () => 'https://www.charitme.com' }));
vi.mock('../lib/payout-destination', () => ({
  PayoutLookupUnavailableError: class PayoutLookupUnavailableError extends Error {},
  resolvePayoutDestination: resolveDestination,
}));
vi.mock('../lib/stripe', () => ({
  checkoutPaymentMethodTypes: () => ['card'],
  createCheckoutSession: createCheckout,
  stripe: { checkout: { sessions: { expire: expireCheckout } } },
}));

vi.mock('../lib/supabase', () => {
  class Query {
    constructor(private readonly table: string) {}
    select(): Query { return this; }
    eq(): Query { return this; }
    async maybeSingle(): Promise<DbResult> {
      if (this.table === 'fundraising_events') return { data: state.event, error: null };
      if (this.table === 'event_tickets') return { data: state.ticket, error: null };
      if (this.table === 'campaigns') return { data: null, error: null };
      return { data: null, error: null };
    }
  }

  return {
    supabaseAdmin: {
      from: (table: string) => new Query(table),
      rpc: async (name: string): Promise<DbResult> => {
        if (name === 'reserve_event_ticket') {
          return state.reserveError
            ? { data: null, error: state.reserveError }
            : {
                data: [{
                  registration_id: REGISTRATION_ID,
                  unit_price_cents: 2500,
                  total_cents: 5000,
                  currency: 'usd',
                }],
                error: null,
              };
        }
        if (name === 'attach_event_ticket_checkout') return { data: true, error: null };
        return { data: true, error: null };
      },
    },
  };
});

import { POST } from '../app/api/events/[id]/tickets/checkout/route';

function request(body: unknown): NextRequest {
  return new NextRequest(`https://www.charitme.com/api/events/${EVENT_ID}/tickets/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: EVENT_ID }) };
const validBody = { ticket_id: TICKET_ID, quantity: 2, request_key: REQUEST_KEY };

describe('paid event ticket checkout route', () => {
  beforeEach(() => {
    state.user = { id: USER_ID, email: 'attendee@example.test' };
    state.rateAllowed = true;
    state.destination = {
      stripeAccountId: 'acct_test',
      recipientUserId: '66666666-6666-4666-8666-666666666666',
      role: 'organizer',
    };
    state.reserveError = null;
    vi.clearAllMocks();
  });

  it('requires authentication before rate limiting', async () => {
    state.user = null;
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('rejects invalid input before reserving inventory', async () => {
    const response = await POST(request({ ticket_id: 'bad', quantity: 0 }), context);
    expect(response.status).toBe(400);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('blocks checkout until the organizer payout account is ready', async () => {
    state.destination = null;
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PAYOUT_NOT_READY' });
  });

  it('maps an existing active registration to a conflict', async () => {
    state.reserveError = { code: '23505', message: 'duplicate' };
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'ALREADY_REGISTERED' });
  });

  it('creates a destination-charge checkout from the reserved database price', async () => {
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      url: 'https://checkout.stripe.test/event',
      registration_id: REGISTRATION_ID,
    });
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_intent_data: expect.objectContaining({
          transfer_data: { destination: 'acct_test' },
          metadata: expect.objectContaining({ type: 'event_ticket', registrationId: REGISTRATION_ID }),
        }),
      }),
      `event_ticket_${REGISTRATION_ID}_${REQUEST_KEY}`,
    );
  });
});
