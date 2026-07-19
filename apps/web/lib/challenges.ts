// Pure business logic for giving challenges.
// No Supabase/Next imports — unit-testable, reusable server + client.

export const CHALLENGE_STATUSES = ['draft', 'active', 'ended', 'archived'] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const CHALLENGE_GOAL_TYPES = ['donation_total', 'donation_count'] as const;
export type ChallengeGoalType = (typeof CHALLENGE_GOAL_TYPES)[number];

export function isChallengeStatus(v: unknown): v is ChallengeStatus {
  return typeof v === 'string' && (CHALLENGE_STATUSES as readonly string[]).includes(v);
}

/** Whether a challenge is currently open to join / accrue progress. */
export function isChallengeLive(
  status: string,
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): boolean {
  if (status !== 'active') return false;
  const t = now.getTime();
  if (startsAt) {
    const s = new Date(startsAt).getTime();
    if (!Number.isNaN(s) && t < s) return false;
  }
  if (endsAt) {
    const e = new Date(endsAt).getTime();
    if (!Number.isNaN(e) && t > e) return false;
  }
  return true;
}

/** Progress percent (0–100) toward a challenge goal. Zero target => 0. */
export function challengeProgressPct(progress: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  const p = Math.max(0, Number(progress) || 0);
  return Math.min(100, Math.round((p / target) * 100));
}

/** Whole days remaining until a challenge ends (>=0), or null when open-ended/ended. */
export function daysRemaining(endsAt: string | null, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  const e = new Date(endsAt).getTime();
  if (Number.isNaN(e)) return null;
  const diff = e - now.getTime();
  if (diff < 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

/**
 * Given a participant's donations to a challenge window, compute their progress
 * value in the units the goal is measured in (cents for donation_total, count
 * for donation_count).
 */
export function computeChallengeProgress(
  goalType: ChallengeGoalType,
  donationCentsList: number[],
): number {
  if (goalType === 'donation_count') return donationCentsList.length;
  return donationCentsList.reduce((sum, c) => sum + (Number(c) || 0), 0);
}
