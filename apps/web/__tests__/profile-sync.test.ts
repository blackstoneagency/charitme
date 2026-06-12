import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const upsert = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({ upsert })),
  },
}));

import { syncUserProfile } from '../lib/profile-sync';

function userFixture(metadata: Record<string, unknown>): User {
  // Supabase User has many auth-provider fields that are irrelevant to this mapper test.
  return {
    id: 'user-123',
    email: 'newworldventurellc@google.com',
    user_metadata: metadata,
  } as User;
}

describe('syncUserProfile', () => {
  it('upserts a signed-in user profile from auth metadata', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    await syncUserProfile(userFixture({
      full_name: 'New World Venture LLC',
      avatar_url: 'https://example.com/avatar.png',
      roles: ['organizer'],
    }));

    expect(upsert).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'newworldventurellc@google.com',
      full_name: 'New World Venture LLC',
      avatar_url: 'https://example.com/avatar.png',
      roles: ['organizer'],
      updated_at: expect.any(String),
    }, { onConflict: 'id' });
  });

  it('falls back to donor role and ignores invalid metadata', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    await syncUserProfile(userFixture({
      full_name: '',
      name: 'Fallback Name',
      roles: ['not-a-real-role'],
    }));

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Fallback Name',
      avatar_url: null,
      roles: ['donor'],
    }), { onConflict: 'id' });
  });
});
