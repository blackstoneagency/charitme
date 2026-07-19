// ─────────────────────────────────────────────────────────────────────────────
// Community challenges — pure domain logic (no I/O, unit-testable).
// Badge catalog + award predicates live in `gamification.ts` (DONOR_BADGES).
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';
import type { DonorStats } from './gamification';

export const CHALLENGE_METRICS = ['donation_count', 'total_cents', 'campaign_count'] as const;
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  goal_value: number;
  starts_at: string | null;
  ends_at: string | null;
  status: 'draft' | 'active' | 'completed';
}

/** The user's current value for a challenge's metric, derived from donor stats. */
export function metricValue(stats: DonorStats, metric: ChallengeMetric): number {
  switch (metric) {
    case 'donation_count': return stats.donationCount;
    case 'total_cents': return stats.totalCents;
    case 'campaign_count': return stats.campaignCount;
    default: return 0;
  }
}

/** Progress toward a challenge goal as a 0–100 percentage (clamped). */
export function challengeProgressPercent(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((value / goal) * 100));
}

/** Whether the user has met the challenge goal. */
export function isChallengeComplete(value: number, goal: number): boolean {
  return goal > 0 && value >= goal;
}

/** A human label for a metric, e.g. for progress copy. */
export function metricLabel(metric: ChallengeMetric): string {
  switch (metric) {
    case 'donation_count': return 'donations';
    case 'total_cents': return 'raised';
    case 'campaign_count': return 'campaigns';
    default: return '';
  }
}

export const ChallengeCreateSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{3,60}$/),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  metric: z.enum(CHALLENGE_METRICS).default('donation_count'),
  goal_value: z.number().int().min(1).max(1_000_000_000_000),
  status: z.enum(['draft', 'active', 'completed']).default('active'),
});
