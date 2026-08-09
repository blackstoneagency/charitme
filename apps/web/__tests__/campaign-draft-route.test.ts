import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type DbResult = {
  data: unknown;
  error: { message: string } | null;
};

const state = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  rateAllowed: true,
  updated: { data: { id: '22222222-2222-4222-8222-222222222222' }, error: null } as DbResult,
  existing: { data: null, error: null } as DbResult,
  filters: [] as Array<[string, string, unknown]>,
  insertCalls: 0,
}));

const rateLimit = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.rateAllowed));

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: rateLimit }));
vi.mock('../lib/supabase-server', () => {
  class Query {
    private mode: 'read' | 'update' | 'insert' = 'read';

    update(): Query { this.mode = 'update'; return this; }
    insert(): Query { this.mode = 'insert'; state.insertCalls += 1; return this; }
    select(): Query { return this; }
    eq(field: string, value: unknown): Query { state.filters.push(['eq', field, value]); return this; }
    lte(field: string, value: unknown): Query { state.filters.push(['lte', field, value]); return this; }
    async maybeSingle(): Promise<DbResult> {
      return this.mode === 'update' ? state.updated : state.existing;
    }
    async single(): Promise<DbResult> {
      return { data: { id: '33333333-3333-4333-8333-333333333333' }, error: null };
    }
  }

  return {
    createClient: async () => ({
      auth: {
        getUser: async (): Promise<{ data: { user: { id: string } | null } }> => ({ data: { user: state.user } }),
      },
      from: (): Query => new Query(),
    }),
  };
});

import { PUT } from '../app/api/campaigns/draft/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_ID = '22222222-2222-4222-8222-222222222222';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/campaigns/draft', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validDraft(ts = 200): Record<string, unknown> {
  return {
    id: DRAFT_ID,
    step: 'story',
    storyMode: 'guided',
    builderPath: 'guided',
    schemaVersion: 2,
    sourceContext: {},
    form: { title: 'Community recovery' },
    images: [],
    ts,
  };
}

describe('campaign draft autosave route', () => {
  beforeEach(() => {
    state.user = { id: USER_ID };
    state.rateAllowed = true;
    state.updated = { data: { id: DRAFT_ID }, error: null };
    state.existing = { data: null, error: null };
    state.filters = [];
    state.insertCalls = 0;
    vi.clearAllMocks();
  });

  it('rejects a missing session before consuming rate-limit capacity', async () => {
    state.user = null;
    const response = await PUT(request(validDraft()));
    expect(response.status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('rejects invalid draft input before querying Supabase', async () => {
    const response = await PUT(request({ id: 'not-a-uuid', form: null }));
    expect(response.status).toBe(400);
    expect(state.filters).toEqual([]);
  });

  it('updates only the owner draft when the incoming version is current', async () => {
    const response = await PUT(request(validDraft(250)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: DRAFT_ID });
    expect(state.filters).toEqual(expect.arrayContaining([
      ['eq', 'id', DRAFT_ID],
      ['eq', 'user_id', USER_ID],
      ['lte', 'client_ts', 250],
    ]));
  });

  it('does not let a late older autosave overwrite or duplicate newer work', async () => {
    state.updated = { data: null, error: null };
    state.existing = { data: { id: DRAFT_ID, client_ts: 500 }, error: null };
    const response = await PUT(request(validDraft(200)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: DRAFT_ID, stale: true });
    expect(state.insertCalls).toBe(0);
  });

  it('rate limits autosave bursts after authentication', async () => {
    state.rateAllowed = false;
    const response = await PUT(request(validDraft()));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });
});
