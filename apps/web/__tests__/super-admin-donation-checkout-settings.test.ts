import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DONATION_CHECKOUT_SETTINGS } from '@shared/fees';

const state = vi.hoisted(() => ({
  authorized: true,
  existing: {
    id: 1,
    config: {
      platformName: 'CharitMe',
      payment: { featuredCampaignPriceCents: 500 },
    },
  } as { id: number; config: Record<string, unknown> } | null,
  readError: null as { message: string } | null,
  writeError: null as { message: string } | null,
  write: null as Record<string, unknown> | null,
  insert: false,
}));

const revalidateTag = vi.hoisted(() => vi.fn());
const logSuperAdminAction = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('../lib/super-admin', () => ({
  guardSuperAdmin: async () => state.authorized
    ? { ok: true, user: { id: '11111111-1111-4111-8111-111111111111' } }
    : { ok: false, response: Response.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }) },
  logSuperAdminAction,
}));
vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.readError ? null : state.existing, error: state.readError }),
        }),
      }),
      update: (value: Record<string, unknown>) => ({
        eq: async () => {
          state.write = value;
          state.insert = false;
          return { error: state.writeError };
        },
      }),
      insert: async (value: Record<string, unknown>) => {
        state.write = value;
        state.insert = true;
        return { error: state.writeError };
      },
    }),
  },
}));

function request(body: unknown): never {
  return new Request('http://localhost/api/admin/super/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.resetModules();
  state.authorized = true;
  state.existing = {
    id: 1,
    config: {
      platformName: 'CharitMe',
      payment: { featuredCampaignPriceCents: 500 },
    },
  };
  state.readError = null;
  state.writeError = null;
  state.write = null;
  state.insert = false;
  revalidateTag.mockClear();
  logSuperAdminAction.mockClear();
});

describe('Super Admin donation checkout settings', () => {
  it('requires the super-admin guard before any database operation', async () => {
    state.authorized = false;
    const { PATCH } = await import('../app/api/admin/super/settings/route');
    const response = await PATCH(request({ donationCheckout: DEFAULT_DONATION_CHECKOUT_SETTINGS }));

    expect(response.status).toBe(403);
    expect(state.write).toBeNull();
  });

  it('rejects malformed pricing without writing', async () => {
    const { PATCH } = await import('../app/api/admin/super/settings/route');
    const response = await PATCH(request({
      donationCheckout: {
        ...DEFAULT_DONATION_CHECKOUT_SETTINGS,
        supportTierPercents: [15, 12, 10, 8, 5, 3, 2, 1],
      },
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_INPUT');
    expect(state.write).toBeNull();
  });

  it('does not overwrite settings when the current record cannot be read', async () => {
    state.readError = { message: 'connection unavailable' };
    const { PATCH } = await import('../app/api/admin/super/settings/route');
    const response = await PATCH(request({ donationCheckout: DEFAULT_DONATION_CHECKOUT_SETTINGS }));

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('SETTINGS_LOOKUP_UNAVAILABLE');
    expect(state.write).toBeNull();
  });

  it('persists nested pricing while preserving other payment settings', async () => {
    const { PATCH } = await import('../app/api/admin/super/settings/route');
    const response = await PATCH(request({ donationCheckout: DEFAULT_DONATION_CHECKOUT_SETTINGS }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.payment.featuredCampaignPriceCents).toBe(500);
    expect(body.config.payment.donationCheckout.amountPresetsCents).toEqual([2500, 5000, 7500, 10000, 15000, 25000]);
    expect((state.write?.config as { payment?: Record<string, unknown> }).payment?.donationCheckout)
      .toEqual(DEFAULT_DONATION_CHECKOUT_SETTINGS);
    expect(state.write?.updated_by).toBe('11111111-1111-4111-8111-111111111111');
    expect(revalidateTag).toHaveBeenCalledWith('platform-settings');
    expect(revalidateTag).toHaveBeenCalledWith('donation-checkout-settings');
    expect(logSuperAdminAction).toHaveBeenCalledOnce();
  });

  it('returns a stable error contract when persistence fails', async () => {
    state.writeError = { message: 'database unavailable' };
    const { PATCH } = await import('../app/api/admin/super/settings/route');
    const response = await PATCH(request({ donationCheckout: DEFAULT_DONATION_CHECKOUT_SETTINGS }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
