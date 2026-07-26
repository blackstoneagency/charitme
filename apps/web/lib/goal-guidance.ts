// ─────────────────────────────────────────────────────────────────────────────
// Goal guidance — "what do campaigns like mine actually raise?"
//
// The goal step asked organizers to pick a number with no reference point, which
// drives both over-ambitious goals (which stall and demoralise) and under-set
// goals (which cap the campaign). This derives an honest suggested range from
// REAL comparable campaigns in the same category.
//
// Everything here is pure so it is fully unit-tested; the route only supplies
// rows from Supabase. Guidance is withheld entirely below MIN_SAMPLE — a range
// computed from two campaigns would be noise dressed up as advice.
// ─────────────────────────────────────────────────────────────────────────────

/** Below this many comparable campaigns we show nothing rather than guess. */
export const MIN_SAMPLE = 5;

export interface GuidanceRow {
  goal_amount: number | null;
  raised_amount: number | null;
}

export interface GoalGuidance {
  available: boolean;
  sampleSize: number;
  /** Suggested range (cents) — the interquartile band of comparable goals. */
  lowCents: number | null;
  highCents: number | null;
  medianGoalCents: number | null;
  medianRaisedCents: number | null;
  /** Share of comparable campaigns that reached their goal, 0..1. */
  goalHitRate: number | null;
  note: string;
}

/**
 * Linear-interpolated percentile over an unsorted numeric list.
 * `p` is 0..1. Returns null for an empty list.
 */
export function percentile(values: number[], p: number): number | null {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  const clamped = Math.max(0, Math.min(1, p));
  const idx = clamped * (nums.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return nums[lo];
  return nums[lo] + (nums[hi] - nums[lo]) * (idx - lo);
}

/** Round to a friendly figure so the UI never suggests "$7,431". */
export function roundToNiceAmount(cents: number): number {
  const dollars = cents / 100;
  if (dollars <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(dollars)));
  const step = dollars >= 10_000 ? magnitude / 2 : magnitude >= 100 ? magnitude / 2 : 50;
  return Math.max(50, Math.round(dollars / step) * step) * 100;
}

export function buildGoalGuidance(rows: GuidanceRow[]): GoalGuidance {
  const goals = rows
    .map((r) => Number(r.goal_amount ?? 0))
    .filter((g) => Number.isFinite(g) && g > 0);

  if (goals.length < MIN_SAMPLE) {
    return {
      available: false,
      sampleSize: goals.length,
      lowCents: null, highCents: null, medianGoalCents: null, medianRaisedCents: null, goalHitRate: null,
      note: 'Not enough comparable campaigns yet to suggest a range.',
    };
  }

  const raised = rows
    .map((r) => Number(r.raised_amount ?? 0))
    .filter((v) => Number.isFinite(v) && v >= 0);

  const p25 = percentile(goals, 0.25);
  const p75 = percentile(goals, 0.75);
  const medianGoal = percentile(goals, 0.5);
  const medianRaised = raised.length > 0 ? percentile(raised, 0.5) : null;

  const hits = rows.filter((r) => {
    const g = Number(r.goal_amount ?? 0);
    const v = Number(r.raised_amount ?? 0);
    return g > 0 && v >= g;
  }).length;

  return {
    available: true,
    sampleSize: goals.length,
    lowCents: p25 == null ? null : roundToNiceAmount(p25),
    highCents: p75 == null ? null : roundToNiceAmount(p75),
    medianGoalCents: medianGoal == null ? null : Math.round(medianGoal),
    medianRaisedCents: medianRaised == null ? null : Math.round(medianRaised),
    goalHitRate: rows.length > 0 ? hits / rows.length : null,
    note: `Based on ${goals.length} comparable campaign${goals.length === 1 ? '' : 's'} in this category.`,
  };
}
