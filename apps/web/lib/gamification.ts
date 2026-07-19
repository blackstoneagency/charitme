export interface GivingLevel {
  name: string;
  icon: string;
  minCents: number;
}

export const GIVING_LEVELS: GivingLevel[] = [
  { name: 'Supporter',  icon: '🌱', minCents: 0 },
  { name: 'Friend',     icon: '🤝', minCents: 2_500 },
  { name: 'Champion',   icon: '⭐', minCents: 10_000 },
  { name: 'Hero',       icon: '🦸', minCents: 50_000 },
  { name: 'Legend',     icon: '👑', minCents: 100_000 },
  { name: 'Icon',       icon: '💎', minCents: 500_000 },
];

export interface GivingLevelProgress {
  current: GivingLevel;
  next: GivingLevel | null;
  progress: number; // 0-100, percent of the way to `next`
  remainingCents: number;
}

export function getGivingLevel(totalCents: number): GivingLevelProgress {
  let current = GIVING_LEVELS[0];
  let next: GivingLevel | null = null;
  for (let i = 0; i < GIVING_LEVELS.length; i++) {
    if (totalCents >= GIVING_LEVELS[i].minCents) {
      current = GIVING_LEVELS[i];
      next = GIVING_LEVELS[i + 1] ?? null;
    } else {
      break;
    }
  }
  if (!next) return { current, next: null, progress: 100, remainingCents: 0 };
  const span = next.minCents - current.minCents;
  const progress = Math.min(100, Math.max(0, Math.round(((totalCents - current.minCents) / span) * 100)));
  return { current, next, progress, remainingCents: Math.max(0, next.minCents - totalCents) };
}

export interface DonorStats {
  donationCount: number;
  totalCents: number;
  campaignCount: number;
  hasRecurring: boolean;
  monthStreak: number;
}

export interface DonorBadge {
  id: string;
  icon: string;
  label: string;
  description: string;
  earned: (stats: DonorStats) => boolean;
}

export const DONOR_BADGES: DonorBadge[] = [
  { id: 'first-gift',     icon: '🎉', label: 'First Gift',           description: 'Made your first donation',        earned: (s) => s.donationCount >= 1 },
  { id: 'frequent-giver', icon: '🎯', label: 'Frequent Giver',        description: 'Made 5 or more donations',        earned: (s) => s.donationCount >= 5 },
  { id: 'multi-cause',    icon: '🌍', label: 'Multi-Cause Champion',  description: 'Supported 3 or more campaigns',   earned: (s) => s.campaignCount >= 3 },
  { id: 'generous',       icon: '💝', label: 'Generous Giver',        description: 'Donated $100 or more in total',   earned: (s) => s.totalCents >= 10_000 },
  { id: 'big-heart',      icon: '💖', label: 'Big Heart',             description: 'Donated $500 or more in total',   earned: (s) => s.totalCents >= 50_000 },
  { id: 'philanthropist', icon: '👑', label: 'Philanthropist',        description: 'Donated $1,000 or more in total', earned: (s) => s.totalCents >= 100_000 },
  { id: 'recurring-hero', icon: '🔁', label: 'Monthly Hero',          description: 'Set up a recurring donation',     earned: (s) => s.hasRecurring },
  { id: 'on-a-streak',    icon: '🔥', label: 'On a Streak',           description: 'Donated 3 months in a row',       earned: (s) => s.monthStreak >= 3 },
];

/** All badge ids a donor has earned given their current stats. */
export function evaluateEarnedBadges(stats: DonorStats): string[] {
  return DONOR_BADGES.filter((b) => b.earned(stats)).map((b) => b.id);
}

/**
 * Badge ids the donor now qualifies for but has not been awarded yet.
 * `alreadyAwarded` is the set/array of badge ids already persisted.
 */
export function newlyEarnedBadges(stats: DonorStats, alreadyAwarded: Iterable<string>): string[] {
  const have = new Set(alreadyAwarded);
  return evaluateEarnedBadges(stats).filter((id) => !have.has(id));
}

// Counts consecutive calendar months (ending this month) that contain at least one donation
export function computeMonthlyStreak(isoDates: string[]): number {
  const months = new Set(
    isoDates.map((d) => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${dt.getMonth()}`;
    }),
  );

  let streak = 0;
  const cursor = new Date();
  while (months.has(`${cursor.getFullYear()}-${cursor.getMonth()}`)) {
    streak++;
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return streak;
}
