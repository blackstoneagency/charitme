import { describe, it, expect, vi } from 'vitest';
import {
  getGivingLevel,
  computeMonthlyStreak,
  DONOR_BADGES,
  GIVING_LEVELS,
  type DonorStats,
} from '../lib/gamification';

describe('getGivingLevel', () => {
  it('places $0 at the first level with progress toward the next', () => {
    const r = getGivingLevel(0);
    expect(r.current.name).toBe('Supporter');
    expect(r.next?.name).toBe('Friend');
    expect(r.progress).toBe(0);
    expect(r.remainingCents).toBe(2_500);
  });

  it('reports the correct level at an exact threshold', () => {
    const r = getGivingLevel(10_000);
    expect(r.current.name).toBe('Champion');
    expect(r.next?.name).toBe('Hero');
    expect(r.progress).toBe(0); // just reached Champion
    expect(r.remainingCents).toBe(40_000);
  });

  it('computes midpoint progress within a band', () => {
    // halfway between Friend (2_500) and Champion (10_000) = 6_250
    const r = getGivingLevel(6_250);
    expect(r.current.name).toBe('Friend');
    expect(r.progress).toBe(50);
    expect(r.remainingCents).toBe(3_750);
  });

  it('caps at the top level with 100% progress and no next', () => {
    const r = getGivingLevel(1_000_000);
    expect(r.current.name).toBe('Icon');
    expect(r.next).toBeNull();
    expect(r.progress).toBe(100);
    expect(r.remainingCents).toBe(0);
  });

  it('never returns progress outside 0–100', () => {
    for (const cents of [-500, 1, 2_499, 99_999, 499_999, 10_000_000]) {
      const r = getGivingLevel(cents);
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(100);
      expect(r.remainingCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('treats negative totals as the base level', () => {
    expect(getGivingLevel(-100).current.name).toBe('Supporter');
  });

  it('levels are strictly ascending by threshold', () => {
    for (let i = 1; i < GIVING_LEVELS.length; i++) {
      expect(GIVING_LEVELS[i].minCents).toBeGreaterThan(GIVING_LEVELS[i - 1].minCents);
    }
  });
});

describe('DONOR_BADGES.earned predicates', () => {
  const base: DonorStats = {
    donationCount: 0, totalCents: 0, campaignCount: 0, hasRecurring: false, monthStreak: 0,
  };
  const badge = (id: string) => DONOR_BADGES.find((b) => b.id === id)!;

  it('first-gift needs >= 1 donation', () => {
    expect(badge('first-gift').earned({ ...base, donationCount: 1 })).toBe(true);
    expect(badge('first-gift').earned(base)).toBe(false);
  });

  it('generous vs big-heart vs philanthropist thresholds', () => {
    expect(badge('generous').earned({ ...base, totalCents: 10_000 })).toBe(true);
    expect(badge('big-heart').earned({ ...base, totalCents: 49_999 })).toBe(false);
    expect(badge('philanthropist').earned({ ...base, totalCents: 100_000 })).toBe(true);
  });

  it('recurring-hero and on-a-streak', () => {
    expect(badge('recurring-hero').earned({ ...base, hasRecurring: true })).toBe(true);
    expect(badge('on-a-streak').earned({ ...base, monthStreak: 3 })).toBe(true);
    expect(badge('on-a-streak').earned({ ...base, monthStreak: 2 })).toBe(false);
  });

  it('badge ids are unique', () => {
    const ids = DONOR_BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('computeMonthlyStreak', () => {
  const iso = (d: Date) => d.toISOString();
  // Built from (year, month) integers on the 15th, NOT via setMonth().
  //
  // The original helper carried the same day-overflow bug as the function it was
  // testing: run on the 31st, `setMonth(getMonth() - 1)` yields June 31 → July 1,
  // so "one month ago" was the CURRENT month and the fixtures silently described
  // a different scenario than the test name claimed. Two bugs that agreed with
  // each other for 28 days a month.
  //
  // The 15th is chosen because no month lacks one, so the date is always real.
  const monthsAgo = (n: number) => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() - n;
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    return new Date(year, month, 15, 12, 0, 0);
  };

  // Pinned to the 31st, because that is the ONLY kind of day the bug appeared on.
  // Written with fake timers rather than relative dates so it fails all month,
  // not just for three days at the end of one — the original defect survived
  // precisely because it was invisible 28 days out of 31.
  it('does not double-count the current month when today is the 31st', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0)); // 31 July 2026
      // A single gift, this month. setMonth(6 - 1) builds June 31 → normalises
      // forward to July 1, so the old loop saw July twice and answered 2.
      expect(computeMonthlyStreak([new Date(2026, 6, 20, 12, 0, 0).toISOString()])).toBe(1);

      // And a genuine two-month streak still reads as 2, so the fix did not just
      // subtract one from everything.
      expect(
        computeMonthlyStreak([
          new Date(2026, 6, 20, 12, 0, 0).toISOString(),
          new Date(2026, 5, 20, 12, 0, 0).toISOString(),
        ]),
      ).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('crosses a year boundary backwards', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0)); // 31 January 2026
      expect(
        computeMonthlyStreak([
          new Date(2026, 0, 10, 12, 0, 0).toISOString(),
          new Date(2025, 11, 10, 12, 0, 0).toISOString(), // December 2025
        ]),
      ).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns 0 with no donations', () => {
    expect(computeMonthlyStreak([])).toBe(0);
  });

  it('counts a current-month-only donation as a streak of 1', () => {
    expect(computeMonthlyStreak([iso(new Date())])).toBe(1);
  });

  it('counts consecutive months ending this month', () => {
    const dates = [iso(monthsAgo(0)), iso(monthsAgo(1)), iso(monthsAgo(2))];
    expect(computeMonthlyStreak(dates)).toBe(3);
  });

  it('stops at the first gap', () => {
    // this month + two months ago (missing last month) → streak of 1
    const dates = [iso(monthsAgo(0)), iso(monthsAgo(2))];
    expect(computeMonthlyStreak(dates)).toBe(1);
  });

  it('returns 0 when the most recent donation is not this month', () => {
    const dates = [iso(monthsAgo(1)), iso(monthsAgo(2))];
    expect(computeMonthlyStreak(dates)).toBe(0);
  });

  it('deduplicates multiple donations in the same month', () => {
    const dates = [iso(monthsAgo(0)), iso(monthsAgo(0)), iso(monthsAgo(1))];
    expect(computeMonthlyStreak(dates)).toBe(2);
  });
});
