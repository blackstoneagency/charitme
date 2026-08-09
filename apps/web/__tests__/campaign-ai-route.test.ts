import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type InsertError = { message: string } | null;

const state = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  rateAllowed: true,
  insertError: null as InsertError,
  inserted: null as Record<string, unknown> | null,
}));

const rateLimit = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.rateAllowed));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async (): Promise<{ data: { user: { id: string } | null } }> => ({ data: { user: state.user } }),
    },
  }),
}));

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: rateLimit }));
vi.mock('../lib/openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/openai')>();
  return { ...actual, openai: null };
});
vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (payload: Record<string, unknown>): Promise<{ error: InsertError }> => {
        state.inserted = payload;
        return { error: state.insertError };
      },
    }),
  },
}));

import { POST } from '../app/api/ai/campaign/route';

function validPayload(): Record<string, unknown> {
  return {
    category: 'Medical',
    goalAmount: 500_000,
    currency: 'EUR',
    beneficiary: 'Sarah',
    notes: 'We need practical help covering urgent recovery costs after a house fire.',
    tone: 'authentic',
    sourceLinks: ['https://example.org/context'],
    sourceDocuments: ['recovery-plan.pdf'],
  };
}

function request(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/campaign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('AI campaign route', () => {
  beforeEach(() => {
    state.user = { id: '11111111-1111-4111-8111-111111111111' };
    state.rateAllowed = true;
    state.insertError = null;
    state.inserted = null;
    vi.clearAllMocks();
  });

  it('authenticates before consuming rate-limit capacity', async () => {
    state.user = null;
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    const response = await POST(request({ ...validPayload(), notes: 'short' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('fails closed when the durable rate limit is exhausted', async () => {
    state.rateAllowed = false;
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('returns and records a complete currency-aware fallback draft', async () => {
    const response = await POST(request(validPayload()));
    const body = await response.json() as { title: string; longPost: string };
    expect(response.status).toBe(200);
    expect(body.title).toContain('Sarah');
    expect(body.longPost).toContain('€5,000.00');
    expect(state.inserted).toMatchObject({
      user_id: state.user?.id,
      generation_type: 'campaign_copilot',
      model: 'fallback',
    });
  });

  it('does not return an unrecorded generation when Supabase persistence fails', async () => {
    state.insertError = { message: 'database unavailable' };
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'GENERATION_SAVE_FAILED' });
  });
});
