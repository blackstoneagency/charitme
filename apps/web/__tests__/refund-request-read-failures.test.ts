import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// A donor asking for their money back must never be told the donation does not
// exist. If the refund path looks broken, the alternative they reach for is a
// chargeback — expensive for the platform and worse for the fundraiser, whose
// campaign balance is what gets clawed back.
//
// `.single()` reports ZERO ROWS AS AN ERROR, so a missing donation and an
// unreadable database produced the same `fetchErr`. POST collapsed both into
// 404 "Donation not found"; GET did not capture the error at all.
//
// The giveaway that this was an oversight rather than a decision: the `refunds`
// read two blocks below each of them ALREADY answered 503 for exactly this case,
// with a comment explaining why. One guarded read and one unguarded read, in the
// same handler.
//
// These execute the real handlers against a fake Supabase and auth.
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: 'donor-1' };

/** Per-table results, so the donation read can fail while `refunds` succeeds. */
let byTable: Record<string, { data: unknown; error: { message: string; code?: string } | null }> = {};

function chain(table: string) {
  const result = byTable[table] ?? { data: null, error: null };
  const target: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return t.then;
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve(result);
      return () => chain(table);
    },
  });
}

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: (table: string) => chain(table) },
}));
vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) } }),
}));
vi.mock('../lib/rate-limit', () => ({ checkRateLimit: async () => ({ ok: true, allowed: true }) }));
vi.mock('../lib/rate-limit-durable', () => ({
  checkRateLimitDurable: async () => ({ ok: true, allowed: true }),
}));

const READ_ERROR = { message: 'connection terminated', code: '08006' };

function req(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/donations/d1/refund-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}
const params = { params: Promise.resolve({ id: 'd1' }) } as never;

beforeEach(() => {
  vi.resetModules();
  byTable = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('a failed donation read is never reported as "no such donation"', () => {
  it('GET answers 503, not 404, when the donation lookup fails', async () => {
    byTable.donations = { data: null, error: READ_ERROR };
    const { GET } = await import('../app/api/donations/[id]/refund-request/route');

    const res = await GET(new Request('http://localhost') as never, params);

    expect(res.status, 'a blip must not read as "your donation does not exist"').toBe(503);
    expect((await res.json()).code).toBe('DONATION_LOOKUP_UNAVAILABLE');
  });

  it('POST answers 503, not 404, when the donation lookup fails', async () => {
    byTable.donations = { data: null, error: READ_ERROR };
    const { POST } = await import('../app/api/donations/[id]/refund-request/route');

    const res = await POST(req({ reason: 'duplicate charge' }), params);

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('DONATION_LOOKUP_UNAVAILABLE');
  });
});

describe('the real 404 and 403 outcomes still work', () => {
  it('GET still answers 404 when the donation genuinely is not there', async () => {
    // The whole point of the split: 503 must not swallow a true not-found.
    byTable.donations = { data: null, error: null };
    const { GET } = await import('../app/api/donations/[id]/refund-request/route');

    const res = await GET(new Request('http://localhost') as never, params);

    expect(res.status).toBe(404);
  });

  it('GET still answers 404 for someone ELSE\'s donation', async () => {
    // 404 rather than 403 on a read of a specific id — 403 would confirm the
    // donation exists to someone who should not know that.
    byTable.donations = { data: { donor_id: 'someone-else' }, error: null };
    const { GET } = await import('../app/api/donations/[id]/refund-request/route');

    const res = await GET(new Request('http://localhost') as never, params);

    expect(res.status).toBe(404);
  });

  it('POST still answers 404 when the donation genuinely is not there', async () => {
    // Added because mutation-testing found this uncovered: deleting POST's
    // `if (!donation)` branch broke NO test, yet it would dereference null on
    // the very next line. A guard nobody exercises is not a guard.
    byTable.donations = { data: null, error: null };
    const { POST } = await import('../app/api/donations/[id]/refund-request/route');

    const res = await POST(req({ reason: 'duplicate charge' }), params);

    expect(res.status).toBe(404);
  });

  it('POST still refuses someone ELSE\'s donation with 403', async () => {
    // POST is a write on a donation the caller named, so 403 is right here: the
    // caller already demonstrated they know the id, and the message is specific.
    byTable.donations = {
      data: {
        id: 'd1', donor_id: 'someone-else', amount_cents: 5000,
        status: 'completed', created_at: new Date().toISOString(), campaign_id: 'c1',
      },
      error: null,
    };
    const { POST } = await import('../app/api/donations/[id]/refund-request/route');

    const res = await POST(req({ reason: 'duplicate charge' }), params);

    expect(res.status).toBe(403);
  });
});
