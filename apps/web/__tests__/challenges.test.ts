import { describe, expect, it } from 'vitest';
import {
  metricValue,
  challengeProgressPercent,
  isChallengeComplete,
  metricLabel,
  ChallengeCreateSchema,
  type ChallengeMetric,
} from '../lib/challenges-core';
import { DONOR_BADGES, type DonorStats } from '../lib/gamification';

const stats: DonorStats = { donationCount: 6, totalCents: 12000, campaignCount: 4, hasRecurring: true, monthStreak: 3 };

describe('metricValue', () => {
  const cases: [ChallengeMetric, number][] = [
    ['donation_count', 6],
    ['total_cents', 12000],
    ['campaign_count', 4],
  ];
  it.each(cases)('%s -> %d', (metric, expected) => {
    expect(metricValue(stats, metric)).toBe(expected);
  });
});

describe('challengeProgressPercent', () => {
  it('clamps between 0 and 100', () => {
    expect(challengeProgressPercent(5, 10)).toBe(50);
    expect(challengeProgressPercent(15, 10)).toBe(100);
    expect(challengeProgressPercent(0, 10)).toBe(0);
    expect(challengeProgressPercent(5, 0)).toBe(0);
  });
});

describe('isChallengeComplete', () => {
  it('is true only when the goal is met', () => {
    expect(isChallengeComplete(5, 5)).toBe(true);
    expect(isChallengeComplete(4, 5)).toBe(false);
    expect(isChallengeComplete(5, 0)).toBe(false);
  });
});

describe('metricLabel', () => {
  it('maps metrics to labels', () => {
    expect(metricLabel('donation_count')).toBe('donations');
    expect(metricLabel('total_cents')).toBe('raised');
    expect(metricLabel('campaign_count')).toBe('campaigns');
  });
});

describe('ChallengeCreateSchema', () => {
  it('accepts a valid challenge', () => {
    expect(ChallengeCreateSchema.safeParse({ slug: 'give-five', title: 'Give Five', goal_value: 5 }).success).toBe(true);
  });
  it('rejects a bad slug or non-positive goal', () => {
    expect(ChallengeCreateSchema.safeParse({ slug: 'Bad Slug', title: 'X Challenge', goal_value: 5 }).success).toBe(false);
    expect(ChallengeCreateSchema.safeParse({ slug: 'ok-slug', title: 'X Challenge', goal_value: 0 }).success).toBe(false);
  });
});

// ── Badge award logic (catalog predicates) ────────────────────────────────────
describe('DONOR_BADGES award predicates', () => {
  it('awards the expected badges for a well-established donor', () => {
    const earned = DONOR_BADGES.filter((b) => b.earned(stats)).map((b) => b.id);
    expect(earned).toEqual(expect.arrayContaining(['first-gift', 'frequent-giver', 'multi-cause', 'generous', 'recurring-hero', 'on-a-streak']));
  });
  it('awards nothing to a brand-new user', () => {
    const empty: DonorStats = { donationCount: 0, totalCents: 0, campaignCount: 0, hasRecurring: false, monthStreak: 0 };
    expect(DONOR_BADGES.filter((b) => b.earned(empty))).toHaveLength(0);
  });
});

// ── RLS policy logic simulation ───────────────────────────────────────────────
describe('challenge_participants RLS: write scope', () => {
  function canWrite(row: { user_id: string }, uid: string | null, isAdmin: boolean): boolean {
    return row.user_id === uid || isAdmin;
  }
  it('the participant can write their own row', () => {
    expect(canWrite({ user_id: 'u1' }, 'u1', false)).toBe(true);
  });
  it('a stranger cannot write it', () => {
    expect(canWrite({ user_id: 'u1' }, 'u2', false)).toBe(false);
  });
});
