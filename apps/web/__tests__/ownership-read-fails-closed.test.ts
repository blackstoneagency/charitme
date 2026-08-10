import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// A-1: `ownedNonprofitIds` swallowed its error and returned `[]`.
//
// That value is not a display figure — it is the AUTHORIZATION INPUT on four
// call sites. `[]` from a failed read is indistinguishable from "this account
// owns no organisation", so a transient database fault produced:
//
//   • POST /api/crm/segments   → 403 Forbidden   ("you don't own that")
//   • POST /api/giving-days    → 403 Forbidden   (via canManageGivingDay)
//   • /dashboard/segments      → "this account does not own one yet"
//   • /dashboard/giving-days   → same, plus an empty list
//
// Every one of those is a FALSE statement about the user's own organisation,
// and 403 is not retryable — a client that sees it stops asking.
//
// It now returns `string[] | null`. The fix must fail CLOSED (the write is still
// refused) but report 503, which is both true and retryable. Both halves are
// asserted here: the refusal AND the status. A test that only checked "not 200"
// would pass against the bug it was written for.
// ─────────────────────────────────────────────────────────────────────────────

const READ_ERROR = { message: 'connection terminated', code: '08006' };
const USER = { id: 'owner-1', email: 'owner@example.com' };
const NONPROFIT = '11111111-1111-4111-8111-111111111111';

let byTable: Record<string, { data: unknown; error: { message: string; code?: string } | null }> = {};
let admin = false;

function chain(table: string) {
  const result = byTable[table] ?? { data: [], error: null };
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

// `react`'s `cache` is a server-runtime primitive vitest does not provide;
// identity is the correct stand-in for a per-request memo in a unit test.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => chain(t) } }));
vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) } }),
}));
vi.mock('../lib/roles', () => ({ isAdmin: async () => admin }));

beforeEach(() => {
  vi.resetModules();
  byTable = {};
  admin = false;
});

/** A request whose body is only read on paths this test never reaches. */
function jsonRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<
    typeof import('../app/api/giving-days/route')['POST']
  >[0];
}

describe('ownedNonprofitIds separates "read failed" from "owns nothing"', () => {
  it('returns null when the read fails', async () => {
    byTable.nonprofit_profiles = { data: null, error: READ_ERROR };
    const { ownedNonprofitIds } = await import('../lib/giving-days-server');
    await expect(ownedNonprofitIds(USER.id)).resolves.toBeNull();
  });

  it('still returns [] when the account genuinely owns nothing', async () => {
    // The distinction is the entire fix: an empty list is a real answer and
    // must keep behaving like one.
    byTable.nonprofit_profiles = { data: [], error: null };
    const { ownedNonprofitIds } = await import('../lib/giving-days-server');
    await expect(ownedNonprofitIds(USER.id)).resolves.toEqual([]);
  });

  it('returns the ids on a successful read', async () => {
    byTable.nonprofit_profiles = { data: [{ id: NONPROFIT }], error: null };
    const { ownedNonprofitIds } = await import('../lib/giving-days-server');
    await expect(ownedNonprofitIds(USER.id)).resolves.toEqual([NONPROFIT]);
  });
});

describe('POST /api/crm/segments', () => {
  it('answers 503, not 403, when ownership cannot be read', async () => {
    byTable.nonprofit_profiles = { data: null, error: READ_ERROR };
    const { POST } = await import('../app/api/crm/segments/route');

    const res = await POST(jsonRequest({ name: 'Lapsed donors', nonprofitId: NONPROFIT, rules: {} }));
    expect(res.status, '403 tells an owner they do not own their organisation').toBe(503);
    expect((await res.json()).code).toBe('OWNERSHIP_UNAVAILABLE');
  });

  it('still refuses a nonprofit the caller really does not own', async () => {
    // Fail closed, not open: the 503 path must not have loosened the real check.
    byTable.nonprofit_profiles = { data: [], error: null };
    const { POST } = await import('../app/api/crm/segments/route');

    const res = await POST(jsonRequest({ name: 'Lapsed donors', nonprofitId: NONPROFIT, rules: {} }));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/giving-days', () => {
  const body = {
    title: 'Spring Giving Day',
    nonprofitId: NONPROFIT,
    startsAt: '2026-05-01T00:00:00.000Z',
    endsAt: '2026-05-02T00:00:00.000Z',
  };

  it('answers 503, not 403, when ownership cannot be read', async () => {
    byTable.nonprofit_profiles = { data: null, error: READ_ERROR };
    const { POST } = await import('../app/api/giving-days/route');

    const res = await POST(jsonRequest(body));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('OWNERSHIP_UNAVAILABLE');
  });

  it('still refuses a stranger with 403', async () => {
    byTable.nonprofit_profiles = { data: [], error: null };
    const { POST } = await import('../app/api/giving-days/route');

    const res = await POST(jsonRequest(body));
    expect(res.status).toBe(403);
  });

  it('does not block an admin, whose authority never came from ownership', async () => {
    // `canManageGivingDay` short-circuits on isAdmin and never reads the list,
    // so failing the request on a read it does not use would be gratuitous.
    admin = true;
    byTable.nonprofit_profiles = { data: null, error: READ_ERROR };
    const { POST } = await import('../app/api/giving-days/route');

    const res = await POST(jsonRequest(body));
    expect(res.status).not.toBe(503);
    expect(res.status).not.toBe(403);
  });
});

describe('listManageableGivingDays', () => {
  it('returns null — not an empty list — when ownership cannot be read', async () => {
    byTable.nonprofit_profiles = { data: null, error: READ_ERROR };
    const { listManageableGivingDays } = await import('../lib/giving-days-server');
    await expect(listManageableGivingDays(USER.id, false)).resolves.toBeNull();
  });

  it('returns [] when the account owns nothing', async () => {
    byTable.nonprofit_profiles = { data: [], error: null };
    const { listManageableGivingDays } = await import('../lib/giving-days-server');
    await expect(listManageableGivingDays(USER.id, false)).resolves.toEqual([]);
  });
});
