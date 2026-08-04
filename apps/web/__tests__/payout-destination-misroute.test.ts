import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// The worst outcome in this codebase is not a declined donation. It is a
// donation that succeeds and pays the WRONG PERSON.
//
// `resolvePayoutDestination` tries the campaign's beneficiary first, then falls
// back to the organizer — deliberately, so that a campaign run on someone's
// behalf pays that person and "the organizer never touches the money either"
// (the file's own header). The readiness lookup dropped its `error`, so:
//
//     beneficiary read FAILS  →  data = null  →  "no beneficiary account"
//                             →  falls through to the ORGANIZER
//
// A transient database failure silently redirects the money. Declining is
// recoverable; paying the wrong person is not.
//
// These tests drive the real resolver against a fake Supabase where the
// beneficiary lookup fails and the organizer lookup succeeds — the exact
// partial failure that a single all-or-nothing mock cannot express.
// ─────────────────────────────────────────────────────────────────────────────

const BENEFICIARY = 'user-beneficiary';
const ORGANIZER = 'user-organizer';

const READY = {
  stripe_account_id: 'acct_organizer',
  details_submitted: true,
  payouts_enabled: true,
  charges_enabled: true,
};

/** Per-user results, so one lookup can fail while the other succeeds. */
let byUser: Record<string, { data: unknown; error: { message: string } | null }> = {};

function chain(userId: { current: string | null }) {
  const target: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') return undefined;
      return (col?: unknown, val?: unknown) => {
        // capture `.eq('user_id', <id>)`
        if (prop === 'eq' && col === 'user_id') userId.current = String(val);
        if (prop === 'maybeSingle') {
          return Promise.resolve(
            byUser[userId.current ?? ''] ?? { data: null, error: null },
          );
        }
        return proxy;
      };
    },
  });
  return proxy;
}

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => {
      const userId = { current: null as string | null };
      return { select: () => chain(userId) };
    },
  },
}));

beforeEach(() => {
  byUser = {};
});

describe('an unreadable beneficiary check never redirects money', () => {
  it('does NOT fall through to the organizer when the beneficiary lookup fails', async () => {
    // The defect, exactly: beneficiary unreadable, organizer perfectly ready.
    byUser[BENEFICIARY] = { data: null, error: { message: 'connection terminated' } };
    byUser[ORGANIZER] = { data: READY, error: null };

    const { resolvePayoutDestination, PayoutLookupUnavailableError } = await import(
      '../lib/payout-destination'
    );

    await expect(
      resolvePayoutDestination({ user_id: ORGANIZER, beneficiary_profile_id: BENEFICIARY }),
      'a failed beneficiary check must not resolve to the organizer',
    ).rejects.toBeInstanceOf(PayoutLookupUnavailableError);
  });

  it('still routes to the beneficiary when the read SUCCEEDS', async () => {
    // Guards the guard: the throw must not have broken the normal path.
    byUser[BENEFICIARY] = {
      data: { ...READY, stripe_account_id: 'acct_beneficiary' },
      error: null,
    };
    byUser[ORGANIZER] = { data: READY, error: null };

    const { resolvePayoutDestination } = await import('../lib/payout-destination');
    const dest = await resolvePayoutDestination({
      user_id: ORGANIZER,
      beneficiary_profile_id: BENEFICIARY,
    });

    expect(dest).toMatchObject({ stripeAccountId: 'acct_beneficiary', role: 'beneficiary' });
  });

  it('still falls through to the organizer when the beneficiary genuinely has no account', async () => {
    // The legitimate fallback — a null row, not an error — must be preserved.
    byUser[BENEFICIARY] = { data: null, error: null };
    byUser[ORGANIZER] = { data: READY, error: null };

    const { resolvePayoutDestination } = await import('../lib/payout-destination');
    const dest = await resolvePayoutDestination({
      user_id: ORGANIZER,
      beneficiary_profile_id: BENEFICIARY,
    });

    expect(dest).toMatchObject({ stripeAccountId: 'acct_organizer', role: 'organizer' });
  });

  it('still returns null when the beneficiary is present but NOT payout-ready', async () => {
    // Readiness is four flags; a half-onboarded account must not be paid.
    byUser[BENEFICIARY] = { data: { ...READY, payouts_enabled: false }, error: null };
    byUser[ORGANIZER] = { data: null, error: null };

    const { resolvePayoutDestination } = await import('../lib/payout-destination');
    const dest = await resolvePayoutDestination({
      user_id: ORGANIZER,
      beneficiary_profile_id: BENEFICIARY,
    });

    expect(dest, 'blocked is the correct answer, and it is not the same as an error').toBeNull();
  });

  it('throws when the ORGANIZER lookup fails too, rather than reporting "not ready"', async () => {
    byUser[ORGANIZER] = { data: null, error: { message: 'connection terminated' } };

    const { resolvePayoutDestination, PayoutLookupUnavailableError } = await import(
      '../lib/payout-destination'
    );

    await expect(
      resolvePayoutDestination({ user_id: ORGANIZER }),
    ).rejects.toBeInstanceOf(PayoutLookupUnavailableError);
  });
});
