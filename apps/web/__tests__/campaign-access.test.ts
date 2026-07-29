import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();
const isAdmin = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
  },
}));

vi.mock('../lib/roles', () => ({ isAdmin }));

const { canViewCampaignAnalytics } = await import('../lib/campaign-access');

describe('campaign analytics authorization', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    isAdmin.mockReset();
    isAdmin.mockResolvedValue(false);
  });

  it('allows the campaign owner without a team lookup', async () => {
    await expect(
      canViewCampaignAnalytics({ id: 'owner' }, 'campaign', 'owner'),
    ).resolves.toBe(true);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('allows a platform admin', async () => {
    isAdmin.mockResolvedValue(true);
    await expect(
      canViewCampaignAnalytics({ id: 'admin' }, 'campaign', 'owner'),
    ).resolves.toBe(true);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin', 'member'])('allows the %s team role', async (role) => {
    maybeSingle.mockResolvedValue({ data: { role } });
    await expect(
      canViewCampaignAnalytics({ id: 'member' }, 'campaign', 'owner'),
    ).resolves.toBe(true);
  });

  it('denies a read-only viewer', async () => {
    maybeSingle.mockResolvedValue({ data: { role: 'viewer' } });
    await expect(
      canViewCampaignAnalytics({ id: 'viewer' }, 'campaign', 'owner'),
    ).resolves.toBe(false);
  });

  it('denies a user with no team membership', async () => {
    maybeSingle.mockResolvedValue({ data: null });
    await expect(
      canViewCampaignAnalytics({ id: 'stranger' }, 'campaign', 'owner'),
    ).resolves.toBe(false);
  });
});
