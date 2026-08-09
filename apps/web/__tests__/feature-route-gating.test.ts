import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// POST/GET /api/campaigns/:id/feature — EXECUTED, for the gates that do not
// need Stripe.
//
// CHAR-1403 lists six checks for the paid featured-placement flow and marks the
// whole item `needs-staging`. Four of the six genuinely do: they end in a real
// Stripe Checkout session and a webhook delivery. **Two do not**, and they are
// the two that matter if this route is wrong:
//
//   (5) an already-featured campaign is refused a second purchase → 400
//   (6) a non-owner POST is refused                                → 403
//
// Both are decided before any Stripe call, so both are testable here — and
// neither was covered. `featured.test.ts` is 21 assertions of pure price and
// rotator logic; it never runs the handler, so nothing established that the
// route checks ownership at all. A missing 403 here means any signed-in user
// can start a paid placement against a stranger's campaign; a missing 400 means
// a creator can be charged twice for a placement they already own.
//
// The 401 and 404 paths come free with the same harness and are asserted too.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

/** Campaign row the fake PostgREST returns; swapped per test. */
let campaignRow: Record<string, unknown> | null = null;
/** Error the campaign read returns, for the 500 path. */
let campaignError: { message: string } | null = null;
/** Session user; null means signed out. */
let sessionUser: { id: string } | null = { id: 'owner-1' };
/** Answer from canManageCampaign. */
let canManage = true;
/** Checkout sessions the route asked Stripe to create. */
let checkoutCalls: Array<{ params: unknown; key: string }> = [];

function builder(table: string) {
  // `platform_settings` feeds the price lookup; everything else in this route
  // reads `campaigns`. A Proxy so any PostgREST method chains — an incomplete
  // method list fails as "query.eq is not a function", which reads exactly like
  // a route bug and is not one.
  const result =
    table === 'platform_settings'
      ? { data: { config: { payment: { featuredCampaignPriceCents: 900 } } }, error: null }
      : { data: campaignRow, error: campaignError };
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === 'then') return target.then;
      if (typeof prop === 'symbol') return undefined;
      return () => builder(table);
    },
  });
}

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: (table: string) => ({ select: () => builder(table) }) },
}));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
  }),
}));

vi.mock('../lib/auth', () => ({
  canManageCampaign: async () => canManage,
}));

vi.mock('../lib/stripe', () => ({
  createCheckoutSession: async (params: unknown, key: string) => {
    checkoutCalls.push({ params, key });
    return { url: 'https://checkout.stripe.test/session' };
  },
}));

vi.mock('../lib/auth-config', () => ({ getAppOrigin: () => 'https://example.test' }));

const { GET, POST } = await import('../app/api/campaigns/[id]/feature/route');

const params = Promise.resolve({ id: 'camp-1' });
const post = (body: unknown = {}) =>
  POST(
    new Request('https://example.test/api/campaigns/camp-1/feature', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as never,
    { params },
  );

beforeEach(() => {
  campaignRow = { id: 'camp-1', slug: 'a', title: 'A campaign', user_id: 'owner-1', featured: false, status: 'active' };
  campaignError = null;
  sessionUser = { id: 'owner-1' };
  canManage = true;
  checkoutCalls = [];
});

describe('the gates that decide before Stripe is ever called', () => {
  it('refuses a non-owner with 403 and starts no checkout', async () => {
    // CHAR-1403 check (6). Without this, any signed-in visitor could open a
    // paid placement against someone else's campaign.
    canManage = false;
    const res = await post();
    expect(res.status).toBe(403);
    expect(checkoutCalls, 'a checkout was created for a non-owner').toHaveLength(0);
  });

  it('refuses a second purchase on an already-featured campaign with 400', async () => {
    // CHAR-1403 check (5). The cost of missing this is a creator charged twice
    // for a placement they already hold.
    campaignRow = { ...(campaignRow as object), featured: true };
    const res = await post();
    expect(res.status).toBe(400);
    expect(checkoutCalls, 'a checkout was created for an already-featured campaign').toHaveLength(0);
  });

  it('refuses a signed-out caller with 401', async () => {
    sessionUser = null;
    expect((await post()).status).toBe(401);
    expect(checkoutCalls).toHaveLength(0);
  });

  it('answers 404 for a campaign that does not exist', async () => {
    campaignRow = null;
    expect((await post()).status).toBe(404);
    expect(checkoutCalls).toHaveLength(0);
  });

  it('answers 500 rather than 404 when the lookup itself fails', async () => {
    // A read failure is not an absent campaign. Reporting "not found" would tell
    // a creator their live campaign is gone.
    campaignError = { message: 'connection reset' };
    expect((await post()).status).toBe(500);
  });
});

describe('the owner path reaches Stripe with the admin-configured price', () => {
  it('charges the configured amount, not a hardcoded default', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(checkoutCalls).toHaveLength(1);
    const params = checkoutCalls[0].params as { line_items: Array<{ price_data: { unit_amount: number } }> };
    // 900 is what the mocked platform_settings row holds — proving the price is
    // read per request rather than falling back to the $5 default.
    expect(params.line_items[0].price_data.unit_amount).toBe(900);
  });

  it('tags the session so the webhook can identify it', async () => {
    // The webhook flips campaigns.featured on `metadata.type === 'feature_campaign'`.
    // If this drifts, payment succeeds and the campaign is never featured.
    await post();
    const params = checkoutCalls[0].params as { metadata: Record<string, string> };
    expect(params.metadata.type).toBe('feature_campaign');
    expect(params.metadata.campaignId).toBe('camp-1');
    expect(params.metadata.userId).toBe('owner-1');
  });

  it('keeps returnTo on a known set instead of accepting a URL', async () => {
    // An open returnTo on a payment route is a redirect gadget.
    await post({ returnTo: 'https://evil.test/steal' });
    const params = checkoutCalls[0].params as { success_url: string; cancel_url: string };
    expect(params.success_url.startsWith('https://example.test/')).toBe(true);
    expect(params.cancel_url.startsWith('https://example.test/')).toBe(true);
    expect(params.success_url).not.toContain('evil.test');
  });

  it('honours the builder return path when it is the known "create" value', async () => {
    await post({ returnTo: 'create' });
    const params = checkoutCalls[0].params as { success_url: string };
    expect(params.success_url).toContain('/create?featured=1');
  });
});

describe('GET gates the read too', () => {
  it('does not confirm a stranger\'s campaign exists', async () => {
    canManage = false;
    const res = await GET(new Request('https://example.test') as never, { params });
    expect(res.status).toBe(403);
  });

  it('reports the live price and featured state to the owner', async () => {
    const res = await GET(new Request('https://example.test') as never, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ priceCents: 900, featured: false });
  });
});
