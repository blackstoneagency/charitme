// ─────────────────────────────────────────────────────────────────────────────
// Goal proceeds breakdown (pure, unit-testable).
//
// Educates the organizer on the goal step of app/create/page.tsx: CharitMe takes
// a 0% platform fee, so the organizer keeps 100% of every gift. The only
// deduction is the payment processor's per-donation fee — and even that reaches
// the recipient in full when the donor opts to cover it (the default).
//
// This is illustrative math for the create flow, not the checkout ledger. The
// authoritative per-donation numbers live in @shared/fees (donationBreakdown).
// We reuse the same processing-fee constants here so the two never drift.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PLATFORM_FEE_PERCENT,
  PROCESSING_FEE_PERCENT,
  PROCESSING_FEE_FIXED_CENTS,
  processingFee,
} from '@shared/fees';

export interface GoalProceeds {
  goalCents: number;
  /** CharitMe platform fee across the whole goal — always 0. */
  platformFeeCents: number;
  /** Platform fee as a percent (0). */
  platformFeePercent: number;
  /**
   * Illustrative processing fee if the WHOLE goal arrived as a single donation
   * and the donor did NOT cover processing. Real donations are split across many
   * gifts (each with its own fixed fee) and donors usually cover it, so this is a
   * conservative single-transaction estimate, not a promise.
   */
  estProcessingCents: number;
  /** Goal minus platform fee (== goal, since platform fee is 0). */
  keptBeforeProcessingCents: number;
  /** Goal minus platform fee minus the illustrative processing estimate. */
  estNetCents: number;
  /** Human-readable processing rate, e.g. "2.9% + $0.30". */
  processingRateLabel: string;
}

export function goalProceeds(rawGoalCents: number): GoalProceeds {
  const goalCents = Math.max(0, Math.round(rawGoalCents || 0));
  const platformFeeCents = Math.round(goalCents * (PLATFORM_FEE_PERCENT / 100));
  const estProcessingCents = goalCents > 0 ? processingFee(goalCents) : 0;
  const keptBeforeProcessingCents = goalCents - platformFeeCents;

  return {
    goalCents,
    platformFeeCents,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    estProcessingCents,
    keptBeforeProcessingCents,
    estNetCents: Math.max(0, keptBeforeProcessingCents - estProcessingCents),
    processingRateLabel: `${PROCESSING_FEE_PERCENT}% + $${(PROCESSING_FEE_FIXED_CENTS / 100).toFixed(2)}`,
  };
}
