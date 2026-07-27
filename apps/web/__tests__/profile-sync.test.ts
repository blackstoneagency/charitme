import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const upsert = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert,
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    })),
  },
}));

import { ensureUserProfile } from '../lib/profile-sync';

function userFixture(metadata: Record<string, unknown>): User {
  // Supabase User has many auth-provider fields that are irrelevant to this mapper test.
  return {
    id: 'user-123',
    email: 'newworldventurellc@google.com',
    user_metadata: metadata,
  } as User;
}

beforeEach(() => {
  upsert.mockReset();
  maybeSingle.mockReset();
});

describe('ensureUserProfile', () => {
  it('creates a missing donor profile without trusting metadata roles', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    upsert.mockResolvedValueOnce({ error: null });

    await ensureUserProfile(userFixture({
      full_name: 'New World Venture LLC',
      avatar_url: 'https://example.com/avatar.png',
      roles: ['admin', 'super_admin'],
    }));

    expect(upsert).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'newworldventurellc@google.com',
      full_name: 'New World Venture LLC',
      avatar_url: 'https://example.com/avatar.png',
      roles: ['donor'],
    }, { onConflict: 'id', ignoreDuplicates: true });
  });

  it('leaves an existing profile untouched', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'user-123' }, error: null });

    await ensureUserProfile(userFixture({
      full_name: 'Stale Metadata Name',
      roles: ['admin'],
    }));

    expect(upsert).not.toHaveBeenCalled();
  });

  it('falls back to donor role and ignores invalid metadata', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    upsert.mockResolvedValueOnce({ error: null });

    await ensureUserProfile(userFixture({
      full_name: '',
      name: 'Fallback Name',
      roles: ['not-a-real-role'],
    }));

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Fallback Name',
      avatar_url: null,
      roles: ['donor'],
    }), expect.anything());
  });

  it('fails when the profile write fails', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    upsert.mockResolvedValueOnce({ error: { message: 'connection refused' } });

    await expect(ensureUserProfile(userFixture({}))).rejects.toThrow('PROFILE_SYNC_FAILED');
  });

  it('fails when the profile lookup fails', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } });

    await expect(ensureUserProfile(userFixture({}))).rejects.toThrow('PROFILE_SYNC_FAILED');
  });
});
