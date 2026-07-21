import { describe, it, expect } from 'vitest';
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
  const monthsAgo = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  };

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
