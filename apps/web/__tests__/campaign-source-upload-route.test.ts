import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  rateAllowed: true,
  uploadError: null as { message: string } | null,
  removeError: null as { message: string } | null,
}));

const rateLimit = vi.hoisted(() => vi.fn(async (): Promise<boolean> => state.rateAllowed));
const upload = vi.hoisted(() => vi.fn(async (): Promise<{ data: { path: string } | null; error: { message: string } | null }> => ({
  data: state.uploadError ? null : { path: 'stored' },
  error: state.uploadError,
})));
const remove = vi.hoisted(() => vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({
  data: null,
  error: state.removeError,
})));

vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async (): Promise<{ data: { user: { id: string } | null }; error: null }> => ({
        data: { user: state.user },
        error: null,
      }),
    },
  }),
}));

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: rateLimit }));
vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({ upload, remove }),
    },
  },
}));

import { DELETE, POST } from '../app/api/upload/campaign-source/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function uploadRequest(file?: File): NextRequest {
  const body = new FormData();
  if (file) body.append('file', file);
  return new NextRequest('http://localhost/api/upload/campaign-source', { method: 'POST', body });
}

function deleteRequest(path: string): NextRequest {
  return new NextRequest('http://localhost/api/upload/campaign-source', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

describe('campaign source document upload route', () => {
  beforeEach(() => {
    state.user = { id: USER_ID };
    state.rateAllowed = true;
    state.uploadError = null;
    state.removeError = null;
    vi.clearAllMocks();
  });

  it('rejects a missing session before consuming rate-limit capacity', async () => {
    state.user = null;
    const response = await POST(uploadRequest(new File(['context'], 'context.txt', { type: 'text/plain' })));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('rejects invalid input before writing to Storage', async () => {
    const response = await POST(uploadRequest(new File(['binary'], 'script.exe', { type: 'application/octet-stream' })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_FILE_TYPE' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects oversized file names before writing to Storage', async () => {
    const response = await POST(uploadRequest(new File(['context'], `${'a'.repeat(256)}.txt`, { type: 'text/plain' })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_FILE_NAME' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('stores an allowed document in the authenticated user folder', async () => {
    const response = await POST(uploadRequest(new File(['campaign context'], 'context.txt', { type: 'text/plain' })));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: 'context.txt', mimeType: 'text/plain' });
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^campaigns/${USER_ID}/sources/[0-9a-f-]+\\.txt$`)),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'text/plain', upsert: false }),
    );
  });

  it('rejects deletion of another user storage path', async () => {
    const response = await DELETE(deleteRequest('campaigns/22222222-2222-4222-8222-222222222222/sources/context.txt'));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(remove).not.toHaveBeenCalled();
  });
});
