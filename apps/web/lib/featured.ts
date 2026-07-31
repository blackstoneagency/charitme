// ─────────────────────────────────────────────────────────────────────────────
// Featured campaigns — pure helpers (no I/O, unit-testable).
//
// A creator can pay a one-time fee (configurable in Super Admin) to have their
// campaign featured in the homepage hero rotator. These helpers resolve the
// admin-configured price and select which campaigns the rotator should show.
// ─────────────────────────────────────────────────────────────────────────────

/** Absolute floor/ceiling for the feature fee (defensive against bad config). */
export const FEATURE_PRICE_MIN_CENTS = 100; // $1.00
export const FEATURE_PRICE_MAX_CENTS = 100_000; // $1,000.00
export const FEATURE_PRICE_DEFAULT_CENTS = 500; // $5.00

/**
 * Resolve the featured-campaign fee (cents) from the platform payment settings,
 * clamped to a sane range. Falls back to the $5 default when unset/invalid.
 */
export function resolveFeaturePriceCents(paymentSettings: unknown): number {
  const raw =
    paymentSettings && typeof paymentSettings === 'object'
      ? (paymentSettings as Record<string, unknown>).featuredCampaignPriceCents
      : undefined;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return FEATURE_PRICE_DEFAULT_CENTS;
  return Math.min(FEATURE_PRICE_MAX_CENTS, Math.max(FEATURE_PRICE_MIN_CENTS, n));
}

export interface RotatorSelectable {
  featured?: boolean | null;
  /** ISO date. Null means the campaign runs indefinitely. */
  deadline?: string | null;
  goal_amount?: number | null;
  raised_amount?: number | null;
}

/**
 * Has the campaign's deadline passed?
 *
 * The boundary matches the campaign page exactly, which renders "This campaign
 * has ended." when `Math.ceil((deadline - now) / day) > 0` is false — i.e. ended
 * precisely when `deadline <= now`. Two different answers to "has this ended"
 * on two surfaces is how a campaign shows as closed on its own page while still
 * rotating through the homepage hero.
 *
 * A null/absent/unparseable deadline is NOT ended: most campaigns have no
 * deadline at all, and treating a missing value as "expired" would empty the
 * rotator.
 */
export function hasEnded(campaign: RotatorSelectable, now: number = Date.now()): boolean {
  if (!campaign.deadline) return false;
  const at = Date.parse(campaign.deadline);
  if (Number.isNaN(at)) return false;
  return at <= now;
}

/**
 * Has the campaign raised its goal?
 *
 * `>=`, not `>`: hitting the goal exactly is reaching it. A goal of 0 or null
 * means "no target set", which can never be reached — otherwise every campaign
 * without a goal would be excluded the moment it took its first donation
 * (0 >= 0 is true), which would silently empty the rotator.
 */
export function hasReachedGoal(campaign: RotatorSelectable): boolean {
  const goal = campaign.goal_amount ?? 0;
  if (goal <= 0) return false;
  return (campaign.raised_amount ?? 0) >= goal;
}

/**
 * May this campaign occupy a homepage rotator slot?
 *
 * Two exclusions, and they exist because a paid placement pointing at a campaign
 * that cannot use the money is worse than an empty slot — for the visitor, who
 * clicks through to a closed campaign, and for the creator who paid for it.
 *
 * ⚠️ The exclusions are ANDed. The requirement reads "not ended or not reached
 * their goal", which as literal boolean logic would admit a campaign that had
 * ended (as long as it had not hit its goal) — that is plainly not the intent,
 * since it would keep expired campaigns in the hero forever. Both conditions
 * must hold: still running, still needing money.
 */
export function isRotatorEligible(campaign: RotatorSelectable, now: number = Date.now()): boolean {
  return !hasEnded(campaign, now) && !hasReachedGoal(campaign);
}

/**
 * Pick which campaigns the hero rotator should cycle through.
 *
 * Order of operations matters:
 *   1. drop everything ineligible — ended or fully funded — regardless of whether
 *      it was paid for. A featured campaign that hit its goal has had its money's
 *      worth and is now taking a slot from a campaign that still needs one.
 *   2. if any ELIGIBLE featured campaigns remain, rotate through ALL of them.
 *      Not a subset: every creator who paid gets a turn.
 *   3. otherwise fall back to eligible non-featured campaigns so the hero still
 *      has something live to show.
 *
 * Returns `[]` when nothing qualifies. That is deliberate and safe — HeroRotator
 * renders a generic "Start a trusted campaign" hero when the list is empty, which
 * is a better answer than rotating a campaign that closed last month.
 *
 * Input order is preserved (callers pre-sort by rank).
 */
export function selectRotatorCampaigns<T extends RotatorSelectable>(
  campaigns: T[],
  now: number = Date.now(),
): T[] {
  const eligible = campaigns.filter((c) => isRotatorEligible(c, now));
  const featured = eligible.filter((c) => c.featured === true);
  return featured.length > 0 ? featured : eligible;
}
