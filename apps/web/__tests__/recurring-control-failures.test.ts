import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// A donor stopping a recurring charge is the highest-consequence self-service
// action on the platform: if it appears to fail, the alternative the donor
// reaches for is their bank.
//
// Two defects, both executed here rather than read:
//
// 1. `.single()` reports ZERO ROWS AS AN ERROR, and the ownership read dropped
//    `error`. A missing subscription and an unreadable database both produced
//    `record = null` → 404 "Subscription not found" to someone trying to cancel
//    a live recurring donation.
//
// 2. The local write after the Stripe call dropped its error and the route still
//    answered `{ ok: true }`. For pause/resume that divergence is PERMANENT:
//    `customer.subscription.updated` only touches memberships and plans, never
//    `recurring_donations`. CharitMe would show "paused" while Stripe is
//    charging again.
//
// These run the real route handlers against a fake Stripe and Supabase.
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: 'donor-1' };
const ROW = { id: 'rec-1', donor_id: 'donor-1', status: 'active' };

let readError: { message: string; code?: string } | null = null;
let readRow: typeof ROW | null = ROW;
let writeError: { message: string } | null = null;
const stripeCalls: Array<{ id: string; args: unknown }> = [];

function chain(result: unknown): Record<string, unknown> {
  const target: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return t.then;
      if (typeof prop === 'symbol') return undefined;
      return () => chain(result);
    },
  });
}

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => chain({ data: readError ? null : readRow, error: readError }),
      update: () => chain({ data: null, error: writeError }),
    }),
  },
}));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) } }),
}));

vi.mock('../lib/stripe', () => ({
  stripe: {
    subscriptions: {
      update: async (id: string, args: unknown) => {
        stripeCalls.push({ id, args });
        return { id };
      },
    },
  },
}));

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/donations/recurring/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.resetModules();
  readError = null;
  readRow = { ...ROW };
  writeError = null;
  stripeCalls.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('a donor is never told their live subscription does not exist', () => {
  it('cancel answers 503, not 404, when the lookup fails', async () => {
    readError = { message: 'connection terminated', code: '08006' };
    const { POST } = await import('../app/api/donations/recurring/cancel/route');

    const res = await POST(req({ subscriptionId: 'sub_1' }));

    expect(res.status, 'a failed read must not read as "no such subscription"').toBe(503);
    expect((await res.json()).code).toBe('SUBSCRIPTION_LOOKUP_UNAVAILABLE');
    expect(stripeCalls, 'nothing may be sent to Stripe on an unverified owner').toEqual([]);
  });

  it('cancel still answers 404 when the subscription genuinely is not there', async () => {
    // The distinction is the whole point — 503 must not swallow a real 404.
    readRow = null;
    const { POST } = await import('../app/api/donations/recurring/cancel/route');

    const res = await POST(req({ subscriptionId: 'sub_missing' }));

    expect(res.status).toBe(404);
  });

  it('pause answers 503, not 404, when the lookup fails', async () => {
    readError = { message: 'connection terminated' };
    const { POST } = await import('../app/api/donations/recurring/pause/route');

    const res = await POST(req({ subscriptionId: 'sub_1', action: 'pause' }));

    expect(res.status).toBe(503);
    expect(stripeCalls).toEqual([]);
  });

  it('still refuses a subscription owned by someone else', async () => {
    // Guards the guard: the 503 branch must not have widened authorization.
    readRow = { ...ROW, donor_id: 'someone-else' };
    const { POST } = await import('../app/api/donations/recurring/cancel/route');

    const res = await POST(req({ subscriptionId: 'sub_1' }));

    expect(res.status).toBe(403);
    expect(stripeCalls).toEqual([]);
  });
});

describe('a Stripe change that did not reach our records is not reported as clean', () => {
  it('cancel reports the cancellation as REAL but flags the record lag', async () => {
    // Stripe is authoritative for whether the donor is charged, and it accepted
    // the cancellation — so this must NOT be a failure. It must also not claim
    // the record is current.
    writeError = { message: 'deadlock detected' };
    const { POST } = await import('../app/api/donations/recurring/cancel/route');

    const res = await POST(req({ subscriptionId: 'sub_1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stripeCancelled, 'the donor must not be told cancelling failed').toBe(true);
    expect(body.recordUpdated, 'nor that our record is current when it is not').toBe(false);
  });

  it('resume surfaces a diverged state instead of answering ok', async () => {
    // The dangerous direction: collection is ON again at Stripe while our record
    // still says paused, and no webhook ever corrects `recurring_donations`.
    readRow = { ...ROW, status: 'paused' };
    writeError = { message: 'deadlock detected' };
    const { POST } = await import('../app/api/donations/recurring/pause/route');

    const res = await POST(req({ subscriptionId: 'sub_1', action: 'resume' }));

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('RECURRING_STATE_DIVERGED');
    expect(stripeCalls.length, 'Stripe was still called — the divergence is real').toBe(1);
  });

  it('the happy path is untouched', async () => {
    const { POST } = await import('../app/api/donations/recurring/cancel/route');

    const res = await POST(req({ subscriptionId: 'sub_1' }));

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(stripeCalls[0]).toMatchObject({ id: 'sub_1', args: { cancel_at_period_end: true } });
  });
});
