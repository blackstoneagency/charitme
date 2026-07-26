import { describe, expect, it } from 'vitest';
import {
  hoursBetween, hoursForCheckout, canCheckIn, totalHours, exportableHours,
  roundHours, isValidCheckInCode, formatCheckInCode, generateCheckInCode,
  MAX_SHIFT_HOURS, CHECKIN_CODE_LENGTH, canTransitionShift, cancellationVoidsLoggedHours,
} from '../lib/volunteer-shifts-core';

// ─────────────────────────────────────────────────────────────────────────────
// CHAR-1102. These hours are exported to employers for corporate
// volunteer-matching, so the tests lean on the cases where a wrong answer would
// be a false claim about a real person's time.
// ─────────────────────────────────────────────────────────────────────────────

const shift = {
  starts_at: '2026-08-01T09:00:00.000Z',
  ends_at: '2026-08-01T13:00:00.000Z',
  capacity: 5,
  filled_count: 2,
  status: 'scheduled' as const,
};

describe('hoursBetween', () => {
  it('measures a normal shift', () => {
    expect(hoursBetween('2026-08-01T09:00:00Z', '2026-08-01T12:30:00Z')).toBe(3.5);
  });

  it('returns 0 when the volunteer never checked out', () => {
    // "We do not know" — not "they did zero hours". The row stays pending.
    expect(hoursBetween('2026-08-01T09:00:00Z', null)).toBe(0);
  });

  it('returns 0 for reversed timestamps rather than negative hours', () => {
    expect(hoursBetween('2026-08-01T12:00:00Z', '2026-08-01T09:00:00Z')).toBe(0);
  });

  it('returns 0 for unparseable input rather than NaN', () => {
    // NaN would propagate into a total and render as "NaN hours" on an export.
    expect(hoursBetween('not-a-date', '2026-08-01T09:00:00Z')).toBe(0);
  });

  it('rounds to two decimals', () => {
    expect(hoursBetween('2026-08-01T09:00:00Z', '2026-08-01T09:20:00Z')).toBe(0.33);
  });
});

describe('hoursForCheckout — runaway clock', () => {
  it('caps a forgotten check-out at MAX_SHIFT_HOURS and says so', () => {
    // Three days of "volunteering" because nobody tapped check-out. Reporting
    // 72h to an employer as measured time is the failure this guards.
    const r = hoursForCheckout('2026-08-01T09:00:00Z', '2026-08-04T09:00:00Z');
    expect(r.hours).toBe(MAX_SHIFT_HOURS);
    expect(r.capped).toBe(true);
  });

  it('does not flag an ordinary shift as capped', () => {
    const r = hoursForCheckout('2026-08-01T09:00:00Z', '2026-08-01T13:00:00Z');
    expect(r).toEqual({ hours: 4, capped: false });
  });
});

describe('canCheckIn', () => {
  const at = (iso: string) => ({ now: new Date(iso), hasOpenCheckIn: false });

  it('allows check-in during the shift', () => {
    expect(canCheckIn(shift, at('2026-08-01T10:00:00Z'))).toEqual({ allowed: true });
  });

  it('allows check-in shortly before the start', () => {
    expect(canCheckIn(shift, at('2026-08-01T08:45:00Z')).allowed).toBe(true);
  });

  it('refuses check-in long before the start', () => {
    expect(canCheckIn(shift, at('2026-08-01T06:00:00Z'))).toEqual({ allowed: false, reason: 'too_early' });
  });

  it('refuses check-in well after the shift ended', () => {
    expect(canCheckIn(shift, at('2026-08-01T18:00:00Z'))).toEqual({ allowed: false, reason: 'shift_over' });
  });

  it('refuses a cancelled shift', () => {
    expect(canCheckIn({ ...shift, status: 'cancelled' }, at('2026-08-01T10:00:00Z')))
      .toEqual({ allowed: false, reason: 'shift_cancelled' });
  });

  it('refuses when the shift is full', () => {
    expect(canCheckIn({ ...shift, filled_count: 5 }, at('2026-08-01T10:00:00Z')))
      .toEqual({ allowed: false, reason: 'shift_full' });
  });

  it('treats null capacity as unlimited', () => {
    expect(canCheckIn({ ...shift, capacity: null, filled_count: 999 }, at('2026-08-01T10:00:00Z')).allowed).toBe(true);
  });

  it('reports an existing check-in ahead of any timing complaint', () => {
    // Scanning the QR twice should say "you are already checked in", not
    // "too early" — the message is what tells the volunteer what to do next.
    const decision = canCheckIn(shift, { now: new Date('2026-08-01T06:00:00Z'), hasOpenCheckIn: true });
    expect(decision).toEqual({ allowed: false, reason: 'already_checked_in' });
  });
});

describe('totalHours', () => {
  it('keeps verified, pending and rejected apart', () => {
    const totals = totalHours([
      { hours: 4, status: 'verified' },
      { hours: 2.5, status: 'verified' },
      { hours: 3, status: 'pending' },
      { hours: 9, status: 'rejected' },
    ]);
    expect(totals).toEqual({ verified: 6.5, pending: 3, rejected: 9 });
  });

  it('never folds pending hours into verified', () => {
    // The whole point of the feature: unverified time must not reach an employer.
    expect(totalHours([{ hours: 100, status: 'pending' }]).verified).toBe(0);
  });

  it('ignores non-finite hours instead of producing NaN', () => {
    expect(totalHours([{ hours: Number.NaN, status: 'verified' }, { hours: 2, status: 'verified' }]).verified).toBe(2);
  });
});

describe('exportableHours', () => {
  const base = { volunteer_user_id: 'u1', opportunity_id: 'o1', checked_in_at: '2026-08-01T09:00:00Z' };

  it('exports verified rows only', () => {
    const rows = exportableHours([
      { ...base, hours: 4, status: 'verified' },
      { ...base, hours: 9, status: 'pending' },
      { ...base, hours: 9, status: 'rejected' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hours).toBe(4);
  });

  it('excludes soft-deleted rows even when verified', () => {
    expect(exportableHours([{ ...base, hours: 4, status: 'verified', deleted_at: '2026-08-02T00:00:00Z' }])).toEqual([]);
  });

  it('excludes zero-hour rows', () => {
    expect(exportableHours([{ ...base, hours: 0, status: 'verified' }])).toEqual([]);
  });

  it('reduces the timestamp to a date', () => {
    expect(exportableHours([{ ...base, hours: 4, status: 'verified' }])[0].date).toBe('2026-08-01');
  });

  it('tolerates a missing check-in timestamp on a manual entry', () => {
    const rows = exportableHours([{ ...base, checked_in_at: null, hours: 4, status: 'verified' }]);
    expect(rows[0].date).toBeNull();
  });
});

describe('check-in codes', () => {
  it('accepts a well-formed code', () => {
    expect(isValidCheckInCode('ABCD2345')).toBe(true);
  });

  it('normalises case and separators from a scan or typed entry', () => {
    expect(formatCheckInCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(isValidCheckInCode(' abcd-2345 ')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidCheckInCode('ABC')).toBe(false);
  });

  it('rejects look-alike characters the alphabet deliberately omits', () => {
    // O/0 and I/1 are excluded so a code read off a printout is not mistyped.
    expect(isValidCheckInCode('ABCDO123')).toBe(false);
    expect(isValidCheckInCode('ABCDI234')).toBe(false);
  });

  it('generates codes that pass its own validator', () => {
    let seed = 0;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 50; i++) {
      const code = generateCheckInCode(random);
      expect(code).toHaveLength(CHECKIN_CODE_LENGTH);
      expect(isValidCheckInCode(code)).toBe(true);
    }
  });
});

describe('roundHours', () => {
  it('rounds to two decimals', () => {
    expect(roundHours(2.3456)).toBe(2.35);
    expect(roundHours(2.3444)).toBe(2.34);
  });

  it('rounds a binary-inexact half down, and that is fine here', () => {
    // 1.005 is not representable in IEEE 754 — the stored value is
    // 1.00499999999999989, so it rounds DOWN to 1. Pinned deliberately rather
    // than worked around: the discrepancy is 0.005h = 18 seconds, far below any
    // meaningful resolution for volunteer time, and a decimal-exact rounding
    // helper would be complexity with no payoff. My first version of this test
    // asserted 1.01 and was simply wrong about the arithmetic.
    expect(roundHours(1.005)).toBe(1);
  });
});

describe('canTransitionShift', () => {
  it('lets an organizer cancel a scheduled shift', () => {
    expect(canTransitionShift('scheduled', 'cancelled')).toEqual({ allowed: true });
  });

  it('lets an organizer mark a shift completed', () => {
    expect(canTransitionShift('scheduled', 'completed')).toEqual({ allowed: true });
  });

  it('treats cancelled as terminal', () => {
    // Re-opening a shift volunteers were told was cancelled would have them
    // arrive to nothing. Schedule a new shift instead.
    expect(canTransitionShift('cancelled', 'scheduled')).toEqual({ allowed: false, reason: 'already_cancelled' });
    expect(canTransitionShift('cancelled', 'completed')).toEqual({ allowed: false, reason: 'already_cancelled' });
  });

  it('allows re-opening a shift closed early', () => {
    // Not symmetric with cancelled on purpose: "completed" is an organizer
    // saying they are done, and being wrong about that is recoverable.
    expect(canTransitionShift('completed', 'scheduled')).toEqual({ allowed: true });
  });

  it('rejects a no-op', () => {
    expect(canTransitionShift('scheduled', 'scheduled')).toEqual({ allowed: false, reason: 'same_status' });
  });
});

describe('cancellationVoidsLoggedHours', () => {
  it('is false — cancelling a shift never erases attendance', () => {
    // A volunteer who turned up and worked is owed that time regardless of what
    // later happens to the shift record. Cancellation stops future check-ins;
    // it is not a way to delete hours someone earned.
    expect(cancellationVoidsLoggedHours()).toBe(false);
  });
});
