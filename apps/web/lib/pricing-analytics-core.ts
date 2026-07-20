// ─────────────────────────────────────────────────────────────────────────────
// Pricing & support analytics — pure logic (no I/O, unit-testable).
//
// Answers the revenue-model questions the pricing audit cares about, computed
// from real donation rows: how much are donors giving, how much optional support
// are they leaving, and how often are they reducing it below the suggested tier?
// Subscription metrics (MRR/ARR/LTV/CAC) live elsewhere once billing exists.
// ─────────────────────────────────────────────────────────────────────────────

import { SUGGESTED_SUPPORT_PERCENT } from '@shared/fees';

export interface DonationStatRow {
  /** Net gift to the recipient, in cents. */
  amountCents: number;
  /** Optional donor support ("tip"), in cents. */
  tipCents: number;
}

export interface SupportBucket {
  label: string;
  /** Inclusive lower / exclusive upper bound on the support % (upper null = open). */
  minPct: number;
  maxPct: number | null;
  count: number;
  share: number; // 0–100, share of all donations
}

export interface PricingAnalytics {
  donationCount: number;
  grossDonationCents: number; // sum of gifts (recipient-directed)
  supportRevenueCents: number; // sum of optional support to CharitMe
  averageDonationCents: number;
  /** Simple mean of each donation's support%, 0–100 (one tenth precision). */
  averageSupportPercent: number;
  /** Support revenue / gross donations, 0–100 (effective take rate from support). */
  effectiveSupportPercent: number;
  /**
   * Share of donations whose support% is BELOW the suggested tier, 0–100.
   * The spec's "support reduction %": how often donors dial support down.
   */
  supportReductionPercent: number;
  /** Share of donations that left ZERO support, 0–100. */
  zeroSupportPercent: number;
  buckets: SupportBucket[];
}

/** Support percent for one donation (tip / gift), guarding divide-by-zero. */
export function supportPercentOf(row: DonationStatRow): number {
  if (row.amountCents <= 0) return 0;
  return (row.tipCents / row.amountCents) * 100;
}

const BUCKET_DEFS: { label: string; minPct: number; maxPct: number | null }[] = [
  { label: '0% (none)', minPct: 0, maxPct: 0.0001 },
  { label: '0–5%', minPct: 0.0001, maxPct: 5 },
  { label: '5–10%', minPct: 5, maxPct: 10 },
  { label: '10–15%', minPct: 10, maxPct: 15 },
  { label: '15%+', minPct: 15, maxPct: null },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computePricingAnalytics(rows: readonly DonationStatRow[]): PricingAnalytics {
  const donationCount = rows.length;
  if (donationCount === 0) {
    return {
      donationCount: 0,
      grossDonationCents: 0,
      supportRevenueCents: 0,
      averageDonationCents: 0,
      averageSupportPercent: 0,
      effectiveSupportPercent: 0,
      supportReductionPercent: 0,
      zeroSupportPercent: 0,
      buckets: BUCKET_DEFS.map((d) => ({ ...d, count: 0, share: 0 })),
    };
  }

  let grossDonationCents = 0;
  let supportRevenueCents = 0;
  let supportPercentSum = 0;
  let reducedCount = 0;
  let zeroCount = 0;
  const bucketCounts = BUCKET_DEFS.map(() => 0);

  for (const row of rows) {
    grossDonationCents += row.amountCents;
    supportRevenueCents += row.tipCents;
    const pct = supportPercentOf(row);
    supportPercentSum += pct;
    if (pct < SUGGESTED_SUPPORT_PERCENT) reducedCount += 1;
    if (row.tipCents <= 0) zeroCount += 1;
    const idx = BUCKET_DEFS.findIndex(
      (d) => pct >= d.minPct && (d.maxPct === null || pct < d.maxPct),
    );
    if (idx >= 0) bucketCounts[idx] += 1;
  }

  const buckets: SupportBucket[] = BUCKET_DEFS.map((d, i) => ({
    ...d,
    count: bucketCounts[i],
    share: round1((bucketCounts[i] / donationCount) * 100),
  }));

  return {
    donationCount,
    grossDonationCents,
    supportRevenueCents,
    averageDonationCents: Math.round(grossDonationCents / donationCount),
    averageSupportPercent: round1(supportPercentSum / donationCount),
    effectiveSupportPercent: grossDonationCents > 0 ? round1((supportRevenueCents / grossDonationCents) * 100) : 0,
    supportReductionPercent: round1((reducedCount / donationCount) * 100),
    zeroSupportPercent: round1((zeroCount / donationCount) * 100),
    buckets,
  };
}
