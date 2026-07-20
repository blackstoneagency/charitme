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
}

/**
 * Pick which campaigns the hero rotator should cycle through. When at least one
 * campaign is featured (a creator has paid), show ONLY featured ones so the paid
 * placement is honoured. Otherwise fall back to the full list so the hero is
 * never empty. Input order is preserved (callers pre-sort by rank).
 */
export function selectRotatorCampaigns<T extends RotatorSelectable>(campaigns: T[]): T[] {
  const featured = campaigns.filter((c) => c.featured === true);
  return featured.length > 0 ? featured : campaigns;
}
