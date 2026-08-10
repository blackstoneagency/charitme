import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type DbResult = { data: unknown; error: { message: string } | null };

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REGISTRATION_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';

const state = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'attendee@example.test' } as { id: string; email: string } | null,
  admin: false,
  rateAllowed: true,
  registration: {
    id: '22222222-2222-4222-8222-222222222222',
    event_id: '33333333-3333-4333-8333-333333333333',
    attendee_id: '11111111-1111-4111-8111-111111111111',
    amount_cents: 5000,
    status: 'confirmed',
    stripe_payment_intent_id: 'pi_event_ticket',
  } as Record<string, unknown> | null,
  event: {
    created_by: '44444444-4444-4444-8444-444444444444',
    starts_at: '2099-12-01T18:00:00.000Z',
  } as Record<string, unknown> | null,
}));

const rateLimit = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.rateAllowed));
const adminCheck = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.admin));
const createRefund = vi.hoisted(() => vi.fn(async () => ({ id: 're_event_ticket' })));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));
vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: rateLimit }));
vi.mock('../lib/roles', () => ({ isAdmin: adminCheck }));
vi.mock('../lib/stripe', () => ({ stripe: { refunds: { create: createRefund } } }));
vi.mock('../lib/supabase', () => {
  class Query {
    constructor(private readonly table: string) {}
    select(): Query { return this; }
    update(): Query { return this; }
    eq(): Query { return this; }
    async in(): Promise<DbResult> { return { data: null, error: null }; }
    async maybeSingle(): Promise<DbResult> {
      if (this.table === 'event_registrations') return { data: state.registration, error: null };
      if (this.table === 'fundraising_events') return { data: state.event, error: null };
      return { data: null, error: null };
    }
  }
  return { supabaseAdmin: { from: (table: string) => new Query(table) } };
});

import { POST } from '../app/api/events/registrations/[id]/refund/route';

function request(body: unknown): NextRequest {
  return new NextRequest(`https://www.charitme.com/api/events/registrations/${REGISTRATION_ID}/refund`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: REGISTRATION_ID }) };

describe('event ticket refund route', () => {
  beforeEach(() => {
    state.user = { id: USER_ID, email: 'attendee@example.test' };
    state.admin = false;
    state.rateAllowed = true;
    state.registration = {
      id: REGISTRATION_ID,
      event_id: EVENT_ID,
      attendee_id: USER_ID,
      amount_cents: 5000,
      status: 'confirmed',
      stripe_payment_intent_id: 'pi_event_ticket',
    };
    state.event = {
      created_by: '44444444-4444-4444-8444-444444444444',
      starts_at: '2099-12-01T18:00:00.000Z',
    };
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    state.user = null;
    const response = await POST(request({}), context);
    expect(response.status).toBe(401);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('validates the request body', async () => {
    const response = await POST(request({ reason: 'x'.repeat(501) }), context);
    expect(response.status).toBe(400);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('forbids an unrelated signed-in user', async () => {
    state.registration = { ...state.registration!, attendee_id: '55555555-5555-4555-8555-555555555555' };
    const response = await POST(request({}), context);
    expect(response.status).toBe(403);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('starts an idempotent full refund for the attendee', async () => {
    const response = await POST(request({ reason: 'Plans changed' }), context);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'refund_pending' });
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_event_ticket',
        reverse_transfer: true,
        metadata: expect.objectContaining({ type: 'event_ticket', registrationId: REGISTRATION_ID }),
      }),
      { idempotencyKey: `event_ticket_refund_${REGISTRATION_ID}` },
    );
  });
});
