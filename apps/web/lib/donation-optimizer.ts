// AI Donation Optimizer — deterministic ask-amount and impact modeling.
// Runs server-side at render time so the donate box adds zero latency.

export interface CampaignStats {
  goalCents: number;
  raisedCents: number;
  backerCount: number;
  createdAt: string; // ISO timestamp
}

export interface OptimizedAsks {
  /** Six preset amounts in dollars, ascending, tuned to the campaign. */
  presets: number[];
  /** The preset to pre-select / highlight as "most popular". */
  recommended: number;
}

/** Round a dollar value to a "clean" ask people actually pick. */
function cleanAsk(dollars: number): number {
  if (dollars <= 10) return Math.max(5, Math.round(dollars / 5) * 5);
  if (dollars <= 50) return Math.round(dollars / 10) * 10;
  if (dollars <= 200) return Math.round(dollars / 25) * 25;
  if (dollars <= 1000) return Math.round(dollars / 50) * 50;
  return Math.round(dollars / 250) * 250;
}

/**
 * Compute preset ask amounts for a campaign.
 *
 * Anchoring logic:
 * - Base anchor is the campaign's average donation when it has enough backers
 *   (donors cluster around the visible social norm), otherwise a goal-scaled
 *   anchor so a $500 goal doesn't show a $2,000 button and a $500k goal
 *   doesn't lead with $50.
 * - The remaining-amount nudge: when the campaign is close to its goal
 *   (>=80% funded), asks shrink toward "finish it" amounts including the
 *   exact remaining amount when it's small.
 */
export function optimizeAsks(stats: CampaignStats): OptimizedAsks {
  const goal = Math.max(stats.goalCents, 100) / 100;
  const raised = Math.max(stats.raisedCents, 0) / 100;
  const remaining = Math.max(goal - raised, 0);
  const progress = Math.min(raised / goal, 1);

  // Anchor: average gift if we have signal, else ~1.5% of goal clamped to [25, 500]
  const avgGift = stats.backerCount >= 5 ? raised / stats.backerCount : 0;
  const anchor = avgGift >= 5 ? avgGift : Math.min(Math.max(goal * 0.015, 25), 500);

  // Near-complete campaigns: "finish it" ladder
  if (progress >= 0.8 && remaining > 0 && remaining <= 2000) {
    const finish = cleanAsk(remaining);
    const ladder = [
      cleanAsk(anchor * 0.5),
      cleanAsk(anchor),
      cleanAsk(anchor * 2),
      cleanAsk(anchor * 4),
      cleanAsk(remaining / 2),
      finish,
    ];
    const presets = dedupeAscending(ladder);
    return { presets, recommended: presets[Math.min(1, presets.length - 1)] };
  }

  const ladder = [
    cleanAsk(anchor * 0.5),
    cleanAsk(anchor),
    cleanAsk(anchor * 2),
    cleanAsk(anchor * 4),
    cleanAsk(anchor * 8),
    cleanAsk(anchor * 16),
  ];
  const presets = dedupeAscending(ladder);
  return { presets, recommended: presets[Math.min(1, presets.length - 1)] };
}

/** Dedupe, sort ascending, and pad to keep the grid visually full. */
function dedupeAscending(values: number[]): number[] {
  const uniq = [...new Set(values.filter(v => v >= 5))].sort((a, b) => a - b);
  while (uniq.length < 6) {
    const last = uniq[uniq.length - 1] ?? 25;
    uniq.push(cleanAsk(last * 2));
  }
  return uniq.slice(0, 6);
}

// ─────────────────────────────────────────────
// Impact Engine — momentum + projection
// ─────────────────────────────────────────────

export interface ImpactSummary {
  /** Average raised per day since launch (cents). */
  dailyVelocityCents: number;
  /** Projected days until goal at current velocity; null when not projectable. */
  projectedDaysToGoal: number | null;
  /** 'surging' | 'steady' | 'starting' */
  momentum: 'surging' | 'steady' | 'starting';
  /** Percent funded, 0–100. */
  percentFunded: number;
}

export function computeImpact(stats: CampaignStats, now: Date = new Date()): ImpactSummary {
  const ageDays = Math.max((now.getTime() - new Date(stats.createdAt).getTime()) / 86_400_000, 0.5);
  const dailyVelocityCents = Math.round(stats.raisedCents / ageDays);
  const remainingCents = Math.max(stats.goalCents - stats.raisedCents, 0);
  const percentFunded = Math.min(Math.round((stats.raisedCents / Math.max(stats.goalCents, 1)) * 100), 100);

  const projectedDaysToGoal =
    remainingCents === 0 ? 0
    : dailyVelocityCents >= 100 ? Math.ceil(remainingCents / dailyVelocityCents)
    : null;

  const momentum: ImpactSummary['momentum'] =
    stats.backerCount >= 10 && dailyVelocityCents >= stats.goalCents / 100 * 2 ? 'surging'
    : stats.backerCount >= 3 ? 'steady'
    : 'starting';

  return { dailyVelocityCents, projectedDaysToGoal, momentum, percentFunded };
}
