// ─────────────────────────────────────────────────────────────────────────────
// Corporate matching gifts — pure domain logic (no I/O, unit-testable).
// Sibling `matching.ts` performs the Supabase queries.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

export type ProgramStatus = 'active' | 'paused' | 'closed';
export type ClaimStatus = 'pending' | 'approved' | 'declined' | 'paid';

export interface MatchingProgram {
  id: string;
  sponsor_id: string;
  company_name: string;
  description: string | null;
  match_ratio: number;
  annual_cap_cents: number;
  min_donation_cents: number;
  categories: string[];
  currency: string;
  status: ProgramStatus;
  created_at: string;
  updated_at: string;
}

export interface MatchingClaim {
  id: string;
  program_id: string;
  employee_id: string;
  campaign_id: string | null;
  donation_id: string | null;
  donation_amount_cents: number;
  match_amount_cents: number;
  status: ClaimStatus;
  note: string | null;
  reviewer_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchInputs {
  donationCents: number;
  matchRatio: number;
  minDonationCents: number;
  /** Remaining per-employee annual cap; use Infinity for an uncapped program. */
  remainingCapCents: number;
}

/**
 * Compute the matched amount (cents) for a donation under a program's rules.
 * Returns 0 below the minimum; otherwise ratio × donation, clamped to the
 * remaining annual cap. `remainingCapCents <= 0` yields 0.
 */
export function computeMatchAmount(inputs: MatchInputs): number {
  const { donationCents, matchRatio, minDonationCents, remainingCapCents } = inputs;
  if (donationCents < minDonationCents) return 0;
  if (remainingCapCents <= 0) return 0;
  const raw = Math.round(donationCents * matchRatio);
  return Math.max(0, Math.min(raw, remainingCapCents));
}

/** Remaining annual cap for an employee given the matched amount already used. */
export function remainingCap(annualCapCents: number, usedCents: number): number {
  if (annualCapCents <= 0) return Number.POSITIVE_INFINITY; // 0 cap = uncapped
  return Math.max(0, annualCapCents - usedCents);
}

/** Whether a program's category rules allow a given campaign category. */
export function categoryEligible(programCategories: readonly string[], category: string | null): boolean {
  if (programCategories.length === 0) return true; // empty = all categories
  if (!category) return false;
  return programCategories.some((c) => c.toLowerCase() === category.toLowerCase());
}

/** Whether the program is currently accepting new match claims. */
export function isAcceptingClaims(p: Pick<MatchingProgram, 'status'>): boolean {
  return p.status === 'active';
}

// ── Claim state machine ───────────────────────────────────────────────────────

const EMPLOYEE_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  pending: [],
  approved: [],
  declined: [],
  paid: [],
};

const SPONSOR_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  pending: ['approved', 'declined'],
  approved: ['paid', 'declined'],
  declined: [],
  paid: [],
};

export type ClaimActor = 'employee' | 'sponsor';

export function canTransitionClaim(actor: ClaimActor, from: ClaimStatus, to: ClaimStatus): boolean {
  const table = actor === 'sponsor' ? SPONSOR_TRANSITIONS : EMPLOYEE_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

/** A claim "reserves" cap while approved or paid. */
export function reservesCap(status: ClaimStatus): boolean {
  return status === 'approved' || status === 'paid';
}

// ── Validation schemas ────────────────────────────────────────────────────────

export const ProgramCreateSchema = z.object({
  company_name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  match_ratio: z.number().positive().max(100).default(1),
  annual_cap_cents: z.number().int().min(0).max(1_000_000_000_000).default(0),
  min_donation_cents: z.number().int().min(0).max(1_000_000_000).default(0),
  categories: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  currency: z.string().trim().length(3).default('USD'),
  status: z.enum(['active', 'paused']).default('active'),
});

export const ProgramUpdateSchema = ProgramCreateSchema.partial().extend({
  status: z.enum(['active', 'paused', 'closed']).optional(),
});

export const ClaimCreateSchema = z.object({
  program_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional().nullable(),
  donation_id: z.string().uuid().optional().nullable(),
  donation_amount_cents: z.number().int().min(1).max(1_000_000_000),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const ClaimUpdateSchema = z.object({
  status: z.enum(['approved', 'declined', 'paid']),
});
