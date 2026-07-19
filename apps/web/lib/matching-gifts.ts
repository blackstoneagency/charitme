// Pure business logic for corporate matching-gift claims.
//
// This module is intentionally free of Supabase/Next imports so it can be unit
// tested in isolation and reused on both server and client. It builds on the
// employer-match estimator in `employer-matching.ts`.

import { EMPLOYER_MATCH_DATABASE, searchEmployerMatch, type EmployerMatchEntry } from './employer-matching';

export const MATCHING_GIFT_STATUSES = [
  'submitted',
  'requested_from_employer',
  'approved',
  'received',
  'declined',
  'cancelled',
] as const;

export type MatchingGiftStatus = (typeof MATCHING_GIFT_STATUSES)[number];

/** Terminal statuses cannot transition further. */
export const TERMINAL_MATCHING_GIFT_STATUSES: readonly MatchingGiftStatus[] = ['received', 'declined', 'cancelled'];

/** Allowed forward transitions in the claim lifecycle. */
const TRANSITIONS: Record<MatchingGiftStatus, readonly MatchingGiftStatus[]> = {
  submitted: ['requested_from_employer', 'approved', 'declined', 'cancelled'],
  requested_from_employer: ['approved', 'declined', 'cancelled'],
  approved: ['received', 'declined', 'cancelled'],
  received: [],
  declined: [],
  cancelled: [],
};

export function isMatchingGiftStatus(value: unknown): value is MatchingGiftStatus {
  return typeof value === 'string' && (MATCHING_GIFT_STATUSES as readonly string[]).includes(value);
}

/** Whether a claim may move from `from` to `to`. Same-status is a no-op (allowed). */
export function canTransitionMatchingGift(from: MatchingGiftStatus, to: MatchingGiftStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Parses an employer's typical-ratio label (e.g. "Up to 3:1", "1:1", "2 : 1")
 * into a numeric multiplier applied to the donation amount. Returns 0 when no
 * ratio can be found so callers can fall back to "unknown / confirm with HR".
 */
export function parseMatchRatio(typicalRatio: string | null | undefined): number {
  if (!typicalRatio) return 0;
  const m = typicalRatio.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const numerator = Number(m[1]);
  const denominator = Number(m[2]);
  if (!denominator || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  const ratio = numerator / denominator;
  return ratio > 0 && Number.isFinite(ratio) ? ratio : 0;
}

/** Estimated matched amount in cents for a donation at a given ratio. */
export function estimateMatchCents(donationCents: number, ratio: number): number {
  if (!Number.isFinite(donationCents) || donationCents <= 0) return 0;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.round(donationCents * ratio);
}

export interface MatchEstimate {
  employer: EmployerMatchEntry | null;
  /** Whether the employer name matched a known program. */
  matched: boolean;
  ratio: number;
  estimatedMatchCents: number;
}

/**
 * Finds the best known employer program for `employerName` and estimates the
 * match for a donation. Falls back to `matched: false` with a 0 estimate for
 * employers not in the directory (donor can still file; ratio confirmed later).
 */
export function estimateMatchForEmployer(donationCents: number, employerName: string): MatchEstimate {
  const trimmed = employerName.trim();
  const results = searchEmployerMatch(trimmed, 1);
  // Prefer an exact (case-insensitive) name match when present.
  const exact = EMPLOYER_MATCH_DATABASE.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  const employer = exact ?? results[0] ?? null;
  const ratio = employer ? parseMatchRatio(employer.typicalRatio) : 0;
  return {
    employer,
    matched: !!employer,
    ratio,
    estimatedMatchCents: estimateMatchCents(donationCents, ratio),
  };
}

/** Human-readable label for a status, for UI badges. */
export function matchingGiftStatusLabel(status: MatchingGiftStatus): string {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'requested_from_employer':
      return 'Requested from employer';
    case 'approved':
      return 'Approved by employer';
    case 'received':
      return 'Match received';
    case 'declined':
      return 'Declined';
    case 'cancelled':
      return 'Cancelled';
  }
}
