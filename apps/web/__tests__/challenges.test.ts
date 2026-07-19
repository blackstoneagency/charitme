import { describe, expect, it } from 'vitest';
import {
  challengeProgressPct,
  computeChallengeProgress,
  daysRemaining,
  isChallengeLive,
  isChallengeStatus,
  isChallengeGoalType,
  slugifyChallenge,
  challengeWindowValid,
} from '../lib/challenges';
import { evaluateEarnedBadges, newlyEarnedBadges, type DonorStats } from '../lib/gamification';

const stats = (over: Partial<DonorStats> = {}): DonorStats => ({
  donationCount: 0,
  totalCents: 0,
  campaignCount: 0,
  hasRecurring: false,
  monthStreak: 0,
  ...over,
});

describe('badge persistence helpers', () => {
  it('evaluates earned badges from stats', () => {
    expect(evaluateEarnedBadges(stats({ donationCount: 1 }))).toContain('first-gift');
    expect(evaluateEarnedBadges(stats({ donationCount: 5 }))).toEqual(expect.arrayContaining(['first-gift', 'frequent-giver']));
    expect(evaluateEarnedBadges(stats())).toEqual([]);
  });
  it('diffs newly-earned against already-awarded', () => {
    const s = stats({ donationCount: 5, totalCents: 10_000 });
    const already = ['first-gift'];
    const fresh = newlyEarnedBadges(s, already);
    expect(fresh).toContain('frequent-giver');
    expect(fresh).toContain('generous');
    expect(fresh).not.toContain('first-gift');
  });
});

describe('challenge status + timing', () => {
  it('validates statuses', () => {
    expect(isChallengeStatus('active')).toBe(true);
    expect(isChallengeStatus('nope')).toBe(false);
  });
  it('is live only when active and within window', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    expect(isChallengeLive('active', '2026-07-01T00:00:00Z', '2026-07-31T00:00:00Z', now)).toBe(true);
    expect(isChallengeLive('draft', '2026-07-01T00:00:00Z', '2026-07-31T00:00:00Z', now)).toBe(false);
    expect(isChallengeLive('active', '2026-08-01T00:00:00Z', null, now)).toBe(false); // not started
    expect(isChallengeLive('active', null, '2026-07-10T00:00:00Z', now)).toBe(false); // ended
    expect(isChallengeLive('active', null, null, now)).toBe(true); // open-ended
  });
});

describe('progress math', () => {
  it('computes percent, clamped', () => {
    expect(challengeProgressPct(50, 100)).toBe(50);
    expect(challengeProgressPct(150, 100)).toBe(100);
    expect(challengeProgressPct(10, 0)).toBe(0);
  });
  it('computes progress by goal type', () => {
    expect(computeChallengeProgress('donation_total', [1000, 2500, 500])).toBe(4000);
    expect(computeChallengeProgress('donation_count', [1000, 2500, 500])).toBe(3);
    expect(computeChallengeProgress('donation_total', [])).toBe(0);
  });
  it('computes days remaining', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    expect(daysRemaining('2026-07-21T12:00:00Z', now)).toBe(2);
    expect(daysRemaining('2026-07-10T00:00:00Z', now)).toBe(0);
    expect(daysRemaining(null, now)).toBeNull();
  });
});

describe('admin authoring helpers', () => {
  it('validates goal types', () => {
    expect(isChallengeGoalType('donation_total')).toBe(true);
    expect(isChallengeGoalType('donation_count')).toBe(true);
    expect(isChallengeGoalType('nope')).toBe(false);
  });
  it('slugifies titles', () => {
    expect(slugifyChallenge('Summer of Giving 2026!')).toBe('summer-of-giving-2026');
    expect(slugifyChallenge('   ')).toBe('challenge');
  });
  it('validates the challenge window', () => {
    expect(challengeWindowValid('2026-07-01T00:00:00Z', '2026-07-31T00:00:00Z')).toBe(true);
    expect(challengeWindowValid('2026-07-31T00:00:00Z', '2026-07-01T00:00:00Z')).toBe(false);
    expect(challengeWindowValid('2026-07-01T00:00:00Z', null)).toBe(true);
    expect(challengeWindowValid(null, '2026-07-01T00:00:00Z')).toBe(true);
  });
});
