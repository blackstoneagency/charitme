import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// An allowance that cannot count must REFUSE, not wave the request through.
//
// Three limit checks shared one shape:
//
//     const { count } = await supabase.from(x).select('id', { count: 'exact' });
//     if ((count ?? 0) >= LIMIT) return 409;
//
// The `error` was discarded, so a failed count became ZERO, the comparison
// passed, and the insert underneath went ahead. The limit silently stopped
// existing exactly when the database was unhealthy.
//
//   api_keys                → UNLIMITED API KEYS. These are credentials, so the
//                             allowance is a security control.
//   campaign_wizard_drafts  → unlimited drafts (abuse / storage).
//   support_cases (seed)    → "not seeded yet", so the seed re-runs and
//                             duplicates every case — not fixable by re-running.
//
// Each now answers 503. Fail-closed costs a retry; fail-open costs credentials.
// ─────────────────────────────────────────────────────────────────────────────

const READ_ERROR = { message: 'connection terminated', code: '08006' };
const USER = { id: 'user-1', email: 'u@example.com' };

let countResult: { count: number | null; error: unknown } = { count: 0, error: null };
const inserted: string[] = [];

function chain(table: string) {
  const target: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ ...countResult, data: null }).then(resolve),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return t.then;
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'insert') return () => { inserted.push(table); return chain(table); };
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: { id: 'new-row' }, error: null });
      }
      return () => chain(table);
    },
  });
}

const client = { from: (t: string) => chain(t) };

vi.mock('../lib/supabase', () => ({ supabaseAdmin: client }));
vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    ...client,
    auth: { getUser: async () => ({ data: { user: USER } }) },
  }),
}));
vi.mock('../lib/auth', () => ({ requireUser: async () => USER, getUser: async () => USER }));
vi.mock('../lib/rate-limit', () => ({ checkRateLimit: async () => ({ ok: true, allowed: true }) }));
vi.mock('../lib/rate-limit-durable', () => ({
  checkRateLimitDurable: async () => ({ ok: true, allowed: true }),
}));
vi.mock('../app/api/admin/users/_auth', () => ({ verifyAdmin: async () => USER }));

beforeEach(() => {
  vi.resetModules();
  countResult = { count: 0, error: null };
  inserted.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// `scopes` must be real API_SCOPES values — 'read' fails the schema and returns
// 400 before the count ever runs, which is how the first version of these tests
// "measured" a path they never reached.
function jsonReq(body: Record<string, unknown>) {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

describe('the API key allowance fails closed', () => {
  it('answers 503 rather than issuing a key it could not count against', async () => {
    countResult = { count: null, error: READ_ERROR };
    const { POST } = await import('../app/api/developers/keys/route');

    const res = await POST(jsonReq({ name: 'test key', scopes: ['campaigns:read'] }));

    expect(res.status, 'an uncountable allowance must refuse').toBe(503);
    expect((await res.json()).code).toBe('KEY_COUNT_UNAVAILABLE');
  });

  it('issues NO key on that path', async () => {
    // The status matters less than this: a credential must not be minted.
    countResult = { count: null, error: READ_ERROR };
    const { POST } = await import('../app/api/developers/keys/route');

    await POST(jsonReq({ name: 'test key', scopes: ['campaigns:read'] }));

    expect(inserted, 'no api_keys row may be written').not.toContain('api_keys');
  });

  it('still enforces the limit when the count SUCCEEDS', async () => {
    // Guards the guard: the 503 branch must not have replaced the real check.
    countResult = { count: 999, error: null };
    const { POST } = await import('../app/api/developers/keys/route');

    const res = await POST(jsonReq({ name: 'test key', scopes: ['campaigns:read'] }));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('LIMIT_REACHED');
  });
});

describe('the seed guard fails closed', () => {
  it('refuses rather than re-seeding and duplicating every case', async () => {
    countResult = { count: null, error: READ_ERROR };
    const { GET } = await import('../app/api/admin/seed-support/route');

    const res = await GET();

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('SEED_COUNT_UNAVAILABLE');
  });

  it('still skips when it can see the data is already seeded', async () => {
    countResult = { count: 500, error: null };
    const { GET } = await import('../app/api/admin/seed-support/route');

    const body = await (await GET()).json();

    expect(body.skipped).toBe(true);
  });
});
