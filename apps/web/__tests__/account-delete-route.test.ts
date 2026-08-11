import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// The delete route's LAST step, which production data makes non-obvious.
//
// Measured against the live database: the Auth Admin API returns 404 for users
// whose `auth.users` row was inserted by SQL rather than created through signup
// — 8 of 8 sampled profiles and 5 of 5 sampled campaign owners. The rows do
// exist: inserting a profile with no auth row is rejected with 23503, so the
// foreign key is enforced and GoTrue simply cannot see them.
//
// So `deleteUser` 404s for a whole class of real accounts. Reporting that as
// PARTIAL tells someone their account was half-deleted and sends them to
// support, when the outcome they asked for has actually been achieved.
//
// A genuine failure (500, timeout) must still report PARTIAL — the two are not
// interchangeable, which is why this is tested in both directions.
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: 'user-1', email: 'a@example.com' };

let deleteUserResult: { error: { status?: number; message: string } | null } = { error: null };
let tombstoneRow: unknown = { id: '00000000-0000-4000-8000-0000deadbeef' };

function chain(): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'update', 'eq', 'insert', 'in', 'delete', 'upsert']) {
    self[method] = () => self;
  }
  self.maybeSingle = () => Promise.resolve({ data: tombstoneRow, error: null });
  self.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return self;
}

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => chain(),
    auth: { admin: { deleteUser: () => Promise.resolve(deleteUserResult) } },
  },
}));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) } }),
}));

function request(confirm: unknown) {
  return { json: async () => ({ confirm }) } as unknown as Parameters<
    typeof import('../app/api/account/delete/route')['POST']
  >[0];
}

beforeEach(() => {
  vi.resetModules();
  process.env.ACCOUNT_SELF_DELETE_ENABLED = 'true';
  deleteUserResult = { error: null };
  tombstoneRow = { id: '00000000-0000-4000-8000-0000deadbeef' };
});

describe('the final auth delete', () => {
  it('succeeds normally', async () => {
    const { POST } = await import('../app/api/account/delete/route');
    const res = await POST(request('DELETE MY ACCOUNT'));
    expect(res.status).toBe(200);
  });

  it('treats "user not found" as DONE, not as a partial failure', async () => {
    // The production case above. The identity is already anonymised and no
    // sign-in is possible either way.
    deleteUserResult = { error: { status: 404, message: 'User not found' } };
    const { POST } = await import('../app/api/account/delete/route');
    const res = await POST(request('DELETE MY ACCOUNT'));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('still reports PARTIAL on a real failure', async () => {
    // The other direction. A 500 means the sign-in genuinely may still work, and
    // the user must be told — collapsing both into "ok" would hide that.
    deleteUserResult = { error: { status: 500, message: 'database unavailable' } };
    const { POST } = await import('../app/api/account/delete/route');
    const res = await POST(request('DELETE MY ACCOUNT'));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('PARTIAL');
  });
});

describe('the gates in front of it', () => {
  it('404s when the feature is off', async () => {
    process.env.ACCOUNT_SELF_DELETE_ENABLED = 'false';
    const { POST } = await import('../app/api/account/delete/route');
    expect((await POST(request('DELETE MY ACCOUNT'))).status).toBe(404);
  });

  it('rejects an unconfirmed request before touching anything', async () => {
    const { POST } = await import('../app/api/account/delete/route');
    expect((await POST(request(true))).status).toBe(400);
  });

  it('refuses when the tombstone is missing', async () => {
    // Without it there is nowhere to move campaigns, payouts and subscriptions,
    // so the delete would cascade into other people's donations.
    tombstoneRow = null;
    const { POST } = await import('../app/api/account/delete/route');
    const res = await POST(request('DELETE MY ACCOUNT'));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('TOMBSTONE_MISSING');
  });
});
