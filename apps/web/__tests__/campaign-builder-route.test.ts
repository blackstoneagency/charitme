import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  rateAllowed: true,
  suspension: 'active',
  profile: { data: { full_name: 'Jordan Lee', identity_verified: true }, error: null } as DbResult,
  payout: { data: { id: 'payout-ready' }, error: null } as DbResult,
  nonprofit: { data: { id: 'verified-nonprofit' }, error: null } as DbResult,
  storageObjects: new Set(['campaigns/11111111-1111-4111-8111-111111111111/cover/cover.webp']),
  storageError: null as { message: string } | null,
  queryFilters: [] as Array<[string, unknown]>,
  rpc: {
    data: { campaign_id: '22222222-2222-4222-8222-222222222222', campaign_slug: 'community-care-test' },
    error: null,
  } as DbResult,
}));

type DbResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

const rateLimit = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.rateAllowed));
const rpc = vi.hoisted(() => vi.fn(() => ({
  single: async (): Promise<DbResult> => state.rpc,
})));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async (): Promise<{ data: { user: { id: string } | null } }> => ({ data: { user: state.user } }),
    },
  }),
}));

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: rateLimit }));
vi.mock('../lib/roles', () => ({
  getSuspensionState: async (): Promise<string> => state.suspension,
}));

vi.mock('../lib/supabase', () => {
  class Query {
    constructor(private readonly table: string) {}
    select(): Query { return this; }
    eq(field: string, value: unknown): Query { state.queryFilters.push([field, value]); return this; }
    not(): Query { return this; }
    neq(): Query { return this; }
    or(): Query { return this; }
    limit(): Query { return this; }
    async maybeSingle(): Promise<DbResult> {
      if (this.table === 'profiles') return state.profile;
      if (this.table === 'connected_accounts') return state.payout;
      if (this.table === 'nonprofit_profiles') return state.nonprofit;
      return { data: null, error: null };
    }
  }

  return {
    supabaseAdmin: {
      from: (table: string): Query => new Query(table),
      rpc,
      storage: {
        from: (bucket: string) => ({
          exists: async (path: string): Promise<{ data: boolean; error: { message: string } | null }> => ({
            data: state.storageObjects.has(path),
            error: state.storageError,
          }),
          getPublicUrl: (path: string): { data: { publicUrl: string } } => ({
            data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` },
          }),
        }),
      },
    },
  };
});

import { POST } from '../app/api/campaigns/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const COVER_URL = `https://example.supabase.co/storage/v1/object/public/campaign-media/campaigns/${USER_ID}/cover/cover.webp`;

function validPayload(): Record<string, unknown> {
  return {
    title: 'Community care campaign',
    description: 'We are raising funds for practical care and recovery support in our neighborhood.',
    goalAmount: 100_000,
    category: 'Community',
    coverImageUrl: COVER_URL,
    imageUrls: [COVER_URL],
    location: 'New York, United States',
    campaignPath: 'personal',
    builderPath: 'guided',
    beneficiaryType: 'self',
    currency: 'USD',
    useOfFunds: [{ id: 'care', label: 'Direct care', amountCents: 100_000 }],
    donationTiers: [],
    faqs: [],
    milestones: [],
    sourceLinks: [],
    sourceDocuments: [],
    media: [{
      mediaType: 'image',
      storagePath: `campaigns/${USER_ID}/cover/cover.webp`,
      publicUrl: COVER_URL,
      altText: 'Community volunteers preparing care packages',
    }],
    allowRecurring: true,
    allowAnonymous: true,
    visibility: 'public',
    acceptDonations: true,
    policyAccepted: true,
    schemaVersion: 2,
    status: 'active',
  };
}

function request(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('unified campaign publish route', () => {
  beforeEach(() => {
    state.user = { id: USER_ID };
    state.rateAllowed = true;
    state.suspension = 'active';
    state.profile = { data: { full_name: 'Jordan Lee', identity_verified: true }, error: null };
    state.payout = { data: { id: 'payout-ready' }, error: null };
    state.nonprofit = { data: { id: 'verified-nonprofit' }, error: null };
    state.storageObjects = new Set([`campaigns/${USER_ID}/cover/cover.webp`]);
    state.storageError = null;
    state.queryFilters = [];
    state.rpc = {
      data: { campaign_id: '22222222-2222-4222-8222-222222222222', campaign_slug: 'community-care-test' },
      error: null,
    };
    vi.clearAllMocks();
  });

  it('rejects a missing session before consuming rate-limit capacity', async () => {
    state.user = null;
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('returns typed validation details for an invalid request', async () => {
    const response = await POST(request({ title: 'x' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects media paths owned by another user', async () => {
    const payload = validPayload();
    payload.media = [{
      mediaType: 'image',
      storagePath: 'campaigns/another-user/cover/cover.webp',
      publicUrl: COVER_URL,
      altText: 'Campaign cover',
    }];
    const response = await POST(request(payload));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'MEDIA_FORBIDDEN' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects traversal-shaped media paths before ownership checks', async () => {
    const payload = validPayload();
    payload.media = [{
      mediaType: 'image',
      storagePath: `campaigns/${USER_ID}/../cover.webp`,
      publicUrl: COVER_URL,
      altText: 'Campaign cover',
    }];
    const response = await POST(request(payload));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_MEDIA_PATH' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an owned path when the uploaded object is missing', async () => {
    state.storageObjects.clear();
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'MEDIA_NOT_FOUND' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('enforces server-confirmed identity and payout readiness', async () => {
    state.profile = { data: { full_name: 'Jordan Lee', identity_verified: false }, error: null };
    let response = await POST(request(validPayload()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'IDENTITY_VERIFICATION_REQUIRED' });

    state.profile = { data: { full_name: 'Jordan Lee', identity_verified: true }, error: null };
    state.payout = { data: null, error: null };
    response = await POST(request(validPayload()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PAYOUT_NOT_READY' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('publishes through the single atomic database function', async () => {
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      slug: 'community-care-test',
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('create_campaign_from_builder', expect.objectContaining({
      p_user_id: USER_ID,
      p_payload: expect.objectContaining({
        builder_path: 'guided',
        goal_amount: 100_000,
        image_urls: [COVER_URL],
      }),
    }));
    expect(state.queryFilters).toEqual(expect.arrayContaining([
      ['charges_enabled', true],
      ['payouts_enabled', true],
      ['details_submitted', true],
      ['verification_status', 'verified'],
    ]));
  });

  it('ignores unverified gallery URLs and publishes only verified Storage media', async () => {
    const payload = validPayload();
    payload.imageUrls = [COVER_URL, 'https://tracker.example/pixel.png'];
    const response = await POST(request(payload));
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('create_campaign_from_builder', expect.objectContaining({
      p_payload: expect.objectContaining({ image_urls: [COVER_URL] }),
    }));
  });
});
