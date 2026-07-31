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

// Counts consecutive calendar months (ending this month) that contain at least one donation
export function computeMonthlyStreak(isoDates: string[]): number {
  const months = new Set(
    isoDates.map((d) => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${dt.getMonth()}`;
    }),
  );

  // ⚠️ Walk back on (year, month) INTEGERS, not with Date.setMonth().
  //
  // `cursor.setMonth(cursor.getMonth() - 1)` looks like "go back one month" and
  // is not. On the 31st of July it builds June 31, which does not exist, so the
  // Date normalises it FORWARD to July 1 — the same month the cursor was already
  // in. The loop then counts that month a second time.
  //
  // Effect on real donors: on the 29th, 30th and 31st of any month, every
  // streak was inflated by one. A donor who had given once, this month, was
  // shown a 2-month streak. It self-corrected on the 1st, which is precisely why
  // it survived — the symptom appears and disappears on its own, and the number
  // is plausible whenever anyone looks.
  //
  // Integer arithmetic has no invalid intermediate state, so there is nothing to
  // normalise.
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  let streak = 0;
  while (months.has(`${year}-${month}`)) {
    streak++;
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return streak;
}
