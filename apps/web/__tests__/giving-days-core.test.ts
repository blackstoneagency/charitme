import { describe, it, expect } from 'vitest';
import {
  givingDayPhase,
  isGivingDayLive,
  givingDayEndsInMs,
  givingDayProgress,
  canManageGivingDay,
  givingDaySlug,
  isValidWindow,
  sortForDisplay,
  POLICY_MIRRORED,
} from '../lib/giving-days-core';

const T = (iso: string) => Date.parse(iso);
const WINDOW = { startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-02T00:00:00Z' };

describe('givingDayPhase', () => {
  it('is upcoming before the start', () => {
    expect(givingDayPhase(WINDOW, T('2026-08-31T23:59:59Z'))).toBe('upcoming');
  });

  it('is live from the start instant, inclusive', () => {
    expect(givingDayPhase(WINDOW, T('2026-09-01T00:00:00Z'))).toBe('live');
  });

  it('is ended AT the end instant, not after it', () => {
    // "Ends at midnight" must not still be taking money at midnight. Same
    // boundary the campaign page uses for a deadline.
    expect(givingDayPhase(WINDOW, T('2026-09-01T23:59:59Z'))).toBe('live');
    expect(givingDayPhase(WINDOW, T('2026-09-02T00:00:00Z'))).toBe('ended');
  });

  it('treats an unreadable window as ended, never live', () => {
    // A live phase puts a donate button on the row. Dates nobody can parse must
    // not do that.
    expect(givingDayPhase({ startsAt: 'nonsense', endsAt: 'nonsense' })).toBe('ended');
    expect(givingDayPhase({ startsAt: '', endsAt: WINDOW.endsAt })).toBe('ended');
  });

  it('isGivingDayLive agrees with the phase', () => {
    expect(isGivingDayLive(WINDOW, T('2026-09-01T12:00:00Z'))).toBe(true);
    expect(isGivingDayLive(WINDOW, T('2026-09-03T00:00:00Z'))).toBe(false);
  });
});

describe('givingDayEndsInMs', () => {
  it('counts down to the end', () => {
    expect(givingDayEndsInMs(WINDOW, T('2026-09-01T23:00:00Z'))).toBe(3_600_000);
  });

  it('never goes negative', () => {
    expect(givingDayEndsInMs(WINDOW, T('2026-10-01T00:00:00Z'))).toBe(0);
  });

  it('is 0 for an unreadable end', () => {
    expect(givingDayEndsInMs({ startsAt: WINDOW.startsAt, endsAt: 'x' })).toBe(0);
  });
});

describe('givingDayProgress', () => {
  it('is a rounded percentage', () => {
    expect(givingDayProgress(2_500_00, 10_000_00)).toBe(25);
  });

  it('distinguishes "no goal" from "nothing raised"', () => {
    // 0% is a claim that nothing came in. No goal is a different fact, and a
    // progress bar that renders 0 for both is lying about one of them.
    expect(givingDayProgress(0, 10_000_00)).toBe(0);
    expect(givingDayProgress(5_000_00, null)).toBeNull();
    expect(givingDayProgress(5_000_00, undefined)).toBeNull();
    expect(givingDayProgress(5_000_00, 0)).toBeNull();
  });

  it('clamps past the goal rather than reporting 340%', () => {
    expect(givingDayProgress(34_000_00, 10_000_00)).toBe(100);
  });
});

describe('canManageGivingDay — mirrors the RLS policy', () => {
  const owner = { userId: 'u1', isAdmin: false, ownedNonprofitIds: ['np1'] };
  const stranger = { userId: 'u2', isAdmin: false, ownedNonprofitIds: ['np2'] };
  const admin = { userId: 'u3', isAdmin: true, ownedNonprofitIds: [] };

  it('names the policy it copies', () => {
    // The service-role client bypasses RLS, so on the public path this function
    // is the only check that runs. Naming the policy is what lets a human diff
    // the two when either changes.
    expect(POLICY_MIRRORED).toBe('giving_days_owner_write');
  });

  it('admits the owner of the linked nonprofit', () => {
    expect(canManageGivingDay(owner, { nonprofit_id: 'np1' })).toBe(true);
  });

  it('refuses everyone else', () => {
    expect(canManageGivingDay(stranger, { nonprofit_id: 'np1' })).toBe(false);
  });

  it('admits admins', () => {
    expect(canManageGivingDay(admin, { nonprofit_id: 'np1' })).toBe(true);
  });

  it('treats a null nonprofit as NOBODY’s, not everyone’s', () => {
    // The column is nullable and the policy's EXISTS finds no row for NULL.
    // Defaulting the other way would hand every signed-in user an unattached
    // event.
    expect(canManageGivingDay(owner, { nonprofit_id: null })).toBe(false);
    expect(canManageGivingDay(stranger, { nonprofit_id: null })).toBe(false);
    expect(canManageGivingDay(admin, { nonprofit_id: null })).toBe(true);
  });

  it('does not admit a user whose owned list is empty', () => {
    expect(canManageGivingDay({ userId: 'u9', isAdmin: false, ownedNonprofitIds: [] }, { nonprofit_id: 'np1' }))
      .toBe(false);
  });
});

describe('givingDaySlug', () => {
  it('lowercases and hyphenates', () => {
    expect(givingDaySlug('Giving Tuesday 2026')).toBe('giving-tuesday-2026');
  });

  it('never returns empty — the column is UNIQUE and NOT NULL', () => {
    expect(givingDaySlug('')).toBe('giving-day');
    expect(givingDaySlug('!!!')).toBe('giving-day');
    expect(givingDaySlug('   ')).toBe('giving-day');
  });

  it('does not leave a trailing hyphen after truncation', () => {
    const slug = givingDaySlug('a'.repeat(58) + ' bb');
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('isValidWindow', () => {
  it('requires the start to precede the end', () => {
    expect(isValidWindow(WINDOW)).toBe(true);
    expect(isValidWindow({ startsAt: WINDOW.endsAt, endsAt: WINDOW.startsAt })).toBe(false);
    expect(isValidWindow({ startsAt: WINDOW.startsAt, endsAt: WINDOW.startsAt })).toBe(false);
  });

  it('rejects unparseable dates', () => {
    expect(isValidWindow({ startsAt: 'x', endsAt: WINDOW.endsAt })).toBe(false);
  });
});

describe('sortForDisplay', () => {
  const now = T('2026-09-01T12:00:00Z');
  const live = { startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-02T00:00:00Z', id: 'live' };
  const liveSooner = { startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-01T18:00:00Z', id: 'liveSooner' };
  const upcoming = { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-02T00:00:00Z', id: 'upcoming' };
  const ended = { startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-02T00:00:00Z', id: 'ended' };

  it('puts live first, then upcoming, then ended', () => {
    const order = sortForDisplay([ended, upcoming, live], now).map((r) => r.id);
    expect(order).toEqual(['live', 'upcoming', 'ended']);
  });

  it('orders live events by which ends soonest', () => {
    const order = sortForDisplay([live, liveSooner], now).map((r) => r.id);
    expect(order).toEqual(['liveSooner', 'live']);
  });

  it('does not mutate its input', () => {
    const input = [ended, live];
    sortForDisplay(input, now);
    expect(input.map((r) => r.id)).toEqual(['ended', 'live']);
  });
});
