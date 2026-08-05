import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// The payout concierge tells a fundraiser two things that matter: how much they
// can withdraw, and whether anything is blocking it. Both were computed from
// reads that discarded their `error`, and both failed in the reassuring
// direction.
//
//   payouts    → `?? []` → alreadyPaidOrPending = 0
//                → availableCents = the FULL raised amount, so the fundraiser is
//                  told they can withdraw money they have already been paid.
//
//   risk_flags → `?? []` → no risk blockers AND
//                `readiness = openFlags && openFlags.length > 0 ? 'blocked' : …`
//                skips the test entirely on null — so a campaign with OPEN FRAUD
//                FLAGS is reported **'ready' to pay out**.
//
// The second is a safety gate that switches itself off when it cannot see. Same
// shape as the reconciliation job reporting a clean bill of health while blind.
// ─────────────────────────────────────────────────────────────────────────────

const READ_ERROR = { message: 'connection terminated', code: '08006' };
const USER = { id: 'organizer-1' };
const CAMPAIGN = {
  id: 'camp-1',
  user_id: USER.id,
  title: 'A Campaign',
  raised_amount: 500_000,
  payout_frozen: false,
  beneficiary_profile_id: null,
};

let byTable: Record<string, { data: unknown; error: { message: string; code?: string } | null }> = {};

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

vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => chain(t) } }));
vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) } }),
}));
vi.mock('../lib/roles', () => ({ isAdmin: async () => false }));
vi.mock('../lib/openai', () => ({ openai: null, OPENAI_MODEL: 'none' }));
vi.mock('../lib/rate-limit-durable', () => ({
  checkRateLimitDurable: async () => ({ ok: true, allowed: true }),
}));
vi.mock('../lib/payout-destination', () => ({
  resolvePayoutDestination: async () => ({
    stripeAccountId: 'acct_1', recipientUserId: USER.id, role: 'organizer',
  }),
  PayoutLookupUnavailableError: class extends Error {},
}));

// GET with `?campaignId=`, not POST — I assumed POST and every test failed with
// "POST is not a function", which is the harness telling me I had not read the
// route. `nextUrl` is what the handler uses, so the fake carries it.
function get() {
  const url = `http://localhost/api/ai/payout-concierge?campaignId=${CAMPAIGN.id}`;
  return { nextUrl: new URL(url), url } as never;
}

beforeEach(() => {
  vi.resetModules();
  byTable = {
    campaigns: { data: CAMPAIGN, error: null },
    // A fully-onboarded account. Without this the default `data: []` is TRUTHY,
    // so `!organizerAccount.details_submitted` fires and every case picks up a
    // stray "finish Stripe onboarding" blocker — which made the ready-path test
    // read `action_needed` and would have masked what it was checking.
    connected_accounts: {
      data: { details_submitted: true, payouts_enabled: true, charges_enabled: true },
      error: null,
    },
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('an unreadable balance is never reported as a spendable one', () => {
  it('answers 503 rather than offering the full raised amount', async () => {
    byTable.payouts = { data: null, error: READ_ERROR };
    const { GET } = await import('../app/api/ai/payout-concierge/route');

    const res = await GET(get());

    expect(res.status, 'a failed payout read must not read as "nothing paid out"').toBe(503);
    expect((await res.json()).code).toBe('PAYOUT_BALANCE_UNAVAILABLE');
  });

  it('still computes a real balance when the read succeeds', async () => {
    // Guards the guard: the error branch must not have broken the arithmetic.
    byTable.payouts = { data: [{ amount_cents: 200_000 }], error: null };
    byTable.risk_flags = { data: [], error: null };
    const { GET } = await import('../app/api/ai/payout-concierge/route');

    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(200);
    // 500,000 raised - 200,000 already paid = 300,000 available.
    expect(JSON.stringify(body)).toContain('300000');
  });
});

describe('an unreadable risk status is never reported as "ready"', () => {
  it('answers 503 rather than clearing a campaign it could not check', async () => {
    // The dangerous one: null flags skip the `blocked` test, so a campaign with
    // open fraud flags would come back 'ready'.
    byTable.payouts = { data: [], error: null };
    byTable.risk_flags = { data: null, error: READ_ERROR };
    const { GET } = await import('../app/api/ai/payout-concierge/route');

    const res = await GET(get());

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('RISK_STATUS_UNAVAILABLE');
  });

  it('still blocks a campaign that genuinely HAS an open flag', async () => {
    byTable.payouts = { data: [], error: null };
    byTable.risk_flags = {
      data: [{ id: 'f1', flag_type: 'duplicate_text', severity: 'high', description: 'Looks copied' }],
      error: null,
    };
    const { GET } = await import('../app/api/ai/payout-concierge/route');

    const body = await (await GET(get())).json();

    expect(body.readiness, 'an open flag must still block').toBe('blocked');
  });

  it('still reports ready when there is genuinely nothing to block', async () => {
    // The opposite direction — over-blocking would make the feature useless.
    byTable.payouts = { data: [], error: null };
    byTable.risk_flags = { data: [], error: null };
    const { GET } = await import('../app/api/ai/payout-concierge/route');

    const body = await (await GET(get())).json();

    expect(body.readiness).toBe('ready');
  });
});
