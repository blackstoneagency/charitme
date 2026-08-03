import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// The Stripe webhook, EXECUTED.
//
// `stripe-webhook-coverage.test.ts` is thorough and entirely source-level: it
// parses route.ts as text and checks that a case exists, that a handler is
// dispatched to, that a `throw` appears in a branch. Every one of its assertions
// passes on code that never runs correctly, because none of them run the code.
//
// That matters here more than anywhere else in the app. The webhook's contract
// with Stripe is:
//
//     the handler throws  →  the route answers 500  →  Stripe redelivers
//
// and its inverse is the failure mode: answering 200 on a write that did not
// happen tells Stripe "processed", it never retries, and the donation is gone
// with the donor's card already charged. Two events were being silently dropped
// that way earlier in this session — a `const { data } = await …` that discarded
// `error`. A source-level test cannot see that; it sees a `case` and a handler.
//
// So these tests run POST() against a fake Stripe and a fake supabaseAdmin, and
// assert on the STATUS CODE, which is the only thing Stripe actually reads.
//
// No Stripe key is needed: signature verification is the mocked seam. This is
// the part of O3 that never required credentials.
// ─────────────────────────────────────────────────────────────────────────────

/** Result the fake `supabaseAdmin` hands back; swapped per test. */
let rpcResult: { data: unknown; error: { message: string; code?: string } | null } = {
  data: 'donation-1',
  error: null,
};
/** Row returned by the `webhook_events` idempotency lookup. */
let existingEvent: { id: string; processed_at: string | null } | null = null;
/** Every table write attempted, so a test can assert what was recorded. */
let writes: Array<{ table: string; op: string; payload: unknown; options?: unknown }> = [];
/** Per-table write failures, so a test can break one table and no others. */
let writeErrors: Record<string, { message: string; code?: string } | undefined> = {};
let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

/**
 * A chainable PostgREST stand-in.
 *
 * Supabase's builder is both chainable and awaitable, so the fake has to be
 * too — otherwise `.select().eq().maybeSingle()` and a bare `await
 * from().upsert()` cannot both work, and the route does both.
 */
function builder(table: string, op: string, payload: unknown) {
  const failure = op !== 'select' ? writeErrors[table] : undefined;
  const result = failure
    ? { data: null, error: failure }
    : table === 'webhook_events' && op === 'select'
      ? { data: existingEvent, error: null }
      : { data: null, error: null };

  // A Proxy rather than a list of methods: PostgREST's builder has dozens
  // (`.or`, `.contains`, `.rangeGte`, …) and an incomplete list fails as
  // "query.or is not a function" — a test-harness defect that looks exactly like
  // a route bug. Anything not `then` chains; `then` resolves.
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === 'then') return target.then;
      if (typeof prop === 'symbol') return undefined;
      return () => builder(table, op, payload);
    },
  });
}

const supabaseAdmin = {
  from(table: string) {
    return {
      select: () => builder(table, 'select', null),
      insert: (payload: unknown) => { writes.push({ table, op: 'insert', payload }); return builder(table, 'insert', payload); },
      upsert: (payload: unknown, options?: unknown) => { writes.push({ table, op: 'upsert', payload, options }); return builder(table, 'upsert', payload); },
      update: (payload: unknown) => { writes.push({ table, op: 'update', payload }); return builder(table, 'update', payload); },
      delete: () => builder(table, 'delete', null),
    };
  },
  rpc(fn: string, args: Record<string, unknown>) {
    rpcCalls.push({ fn, args });
    return Promise.resolve(fn === 'record_donation' ? rpcResult : { data: null, error: null });
  },
};

/** The event `constructEvent` will return; swapped per test. */
let nextEvent: unknown = null;
/** When true, verification fails the way an unsigned/forged body does. */
let signatureValid = true;

vi.mock('../lib/supabase', () => ({ supabaseAdmin }));
vi.mock('../lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: () => {
        if (!signatureValid) throw new Error('No signatures found matching the expected signature');
        return nextEvent;
      },
    },
  },
  formatCents: (c: number) => `$${(c / 100).toFixed(2)}`,
}));

// Outbound effects. Email in particular must not be reachable from a test.
vi.mock('../lib/email', () => ({
  sendReceiptEmail: vi.fn(async () => {}),
  sendTaxReceiptEmail: vi.fn(async () => {}),
  sendOrganizerDonationAlert: vi.fn(async () => {}),
  sendPayoutEmail: vi.fn(async () => {}),
  sendRefundEmail: vi.fn(async () => {}),
}));

function checkoutSessionEvent(id = 'evt_test_1') {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_intent: 'pi_test_1',
        currency: 'usd',
        amount_total: 5000,
        customer_details: { email: 'donor@example.com', name: 'A Donor' },
        metadata: {
          campaignId: 'camp-1',
          donorId: 'user-1',
          tipCents: '0',
          processingFeeCents: '175',
          anonymous: '0',
        },
      },
    },
  };
}

async function post(body = '{}') {
  const { POST } = await import('../app/api/stripe/webhook/route');
  const req = {
    text: async () => body,
    headers: { get: () => 't=1,v1=deadbeef' },
  } as unknown as Parameters<typeof POST>[0];
  return POST(req);
}

beforeEach(() => {
  vi.resetModules();
  writes = [];
  writeErrors = {};
  rpcCalls = [];
  existingEvent = null;
  signatureValid = true;
  rpcResult = { data: 'donation-1', error: null };
  nextEvent = checkoutSessionEvent();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('the contract Stripe actually reads: the status code', () => {
  it('answers 500 when record_donation fails, so Stripe redelivers', async () => {
    // THE test. A 200 here means Stripe marks the event delivered and never
    // retries — the donor is charged and no donation row exists.
    rpcResult = { data: null, error: { message: 'deadlock detected', code: '40P01' } };

    const res = await post();

    expect(res.status, 'a failed donation write MUST NOT be reported as processed').toBe(500);
  });

  it('answers 200 when record_donation succeeds', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('records the failure reason on the event row rather than swallowing it', async () => {
    rpcResult = { data: null, error: { message: 'deadlock detected', code: '40P01' } };

    await post();

    const failure = writes.find(
      (w) => w.table === 'webhook_events' && w.op === 'update' &&
        typeof (w.payload as { processing_error?: string }).processing_error === 'string',
    );
    expect(failure, 'a 500 with no processing_error is undiagnosable after the fact').toBeTruthy();
    expect((failure!.payload as { processing_error: string }).processing_error).toContain('deadlock');
  });

  it('never marks an event processed when the handler threw', async () => {
    rpcResult = { data: null, error: { message: 'boom' } };

    await post();

    const processed = writes.find(
      (w) => w.table === 'webhook_events' && w.op === 'update' &&
        (w.payload as { processed_at?: string }).processed_at !== undefined,
    );
    expect(
      processed,
      'processed_at on a failed event makes the retry a no-op — the donation is lost for good',
    ).toBeUndefined();
  });
});

describe('signature verification is a gate, not a formality', () => {
  it('rejects an unverifiable body with 400', async () => {
    signatureValid = false;
    const res = await post();
    expect(res.status).toBe(400);
  });

  it('writes NOTHING when the signature does not verify', async () => {
    signatureValid = false;

    await post();

    expect(
      writes,
      'an unauthenticated caller must not be able to make this route write to the database',
    ).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });
});

describe('idempotency', () => {
  it('short-circuits an already-processed event without re-running the handler', async () => {
    existingEvent = { id: 'row-1', processed_at: '2026-08-03T00:00:00Z' };

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'already_processed' });
    expect(
      rpcCalls.filter((c) => c.fn === 'record_donation'),
      'a redelivered event must not record the donation twice',
    ).toEqual([]);
  });

  it('passes the Stripe event id to record_donation, which is what makes the RPC idempotent', async () => {
    await post();

    const call = rpcCalls.find((c) => c.fn === 'record_donation');
    expect(call, 'record_donation was never called').toBeTruthy();
    expect(
      call!.args.p_stripe_event_id,
      'without the event id the RPC cannot dedupe, and a Stripe retry double-counts the donation',
    ).toBe('evt_test_1');
  });
});

describe('paid memberships are a money path too', () => {
  // Added because a mutation exposed a hole in THIS file: swallowing the
  // membership error passed every assertion above, and every assertion in the
  // source-level coverage test. The donation path was covered; the branch that
  // strands a paying member outside the paywall was not.
  function membershipEvent() {
    return {
      id: 'evt_member_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_member_1',
          subscription: 'sub_test_1',
          currency: 'usd',
          metadata: { kind: 'membership', tierId: 'tier-1', memberId: 'user-2' },
        },
      },
    };
  }

  it('answers 500 when the membership write fails, so Stripe redelivers', async () => {
    nextEvent = membershipEvent();
    writeErrors.member_subscriptions = { message: 'unique violation', code: '23505' };

    const res = await post();

    expect(
      res.status,
      'a 200 here leaves a subscription charging at Stripe with no row here — the ' +
        'member keeps paying and stays locked out of what they paid for',
    ).toBe(500);
  });

  it('records the membership and answers 200 on the happy path', async () => {
    nextEvent = membershipEvent();

    const res = await post();

    expect(res.status).toBe(200);
    const upsert = writes.find((w) => w.table === 'member_subscriptions' && w.op === 'upsert');
    expect(upsert, 'no membership row was written').toBeTruthy();
    expect(upsert!.payload).toMatchObject({
      tier_id: 'tier-1',
      member_id: 'user-2',
      status: 'active',
      stripe_subscription_id: 'sub_test_1',
    });
  });

  it('upserts on stripe_subscription_id, so a Stripe retry cannot double-bill a member', async () => {
    nextEvent = membershipEvent();

    await post();

    const upsert = writes.find((w) => w.table === 'member_subscriptions' && w.op === 'upsert');
    expect(
      (upsert!.options as { onConflict?: string })?.onConflict,
      'without this conflict target the retry inserts a SECOND membership',
    ).toBe('stripe_subscription_id');
  });

  it('does not fall through to the donation path', async () => {
    // A membership session has no campaignId. Falling through would run the
    // donation handler against a campaign that does not exist.
    nextEvent = membershipEvent();

    await post();

    expect(rpcCalls.filter((c) => c.fn === 'record_donation')).toEqual([]);
  });
});

describe('an unrecognised event does not fail the endpoint', () => {
  it('answers 200 rather than 500, so Stripe does not retry forever', async () => {
    nextEvent = { id: 'evt_unknown', type: 'invoice.upcoming', data: { object: {} } };

    const res = await post();

    expect(res.status).toBe(200);
  });
});
