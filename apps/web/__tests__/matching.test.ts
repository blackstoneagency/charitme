import { describe, expect, it } from 'vitest';
import {
  computeMatchAmount,
  remainingCap,
  categoryEligible,
  isAcceptingClaims,
  canTransitionClaim,
  reservesCap,
  summarizeProgramClaims,
  ProgramCreateSchema,
  ClaimCreateSchema,
  type ClaimStatus,
} from '../lib/matching-core';

describe('computeMatchAmount', () => {
  it('returns 0 below the minimum donation', () => {
    expect(computeMatchAmount({ donationCents: 500, matchRatio: 1, minDonationCents: 1000, remainingCapCents: Infinity })).toBe(0);
  });
  it('applies the ratio for an eligible donation', () => {
    expect(computeMatchAmount({ donationCents: 5000, matchRatio: 1, minDonationCents: 0, remainingCapCents: Infinity })).toBe(5000);
    expect(computeMatchAmount({ donationCents: 5000, matchRatio: 2, minDonationCents: 0, remainingCapCents: Infinity })).toBe(10000);
  });
  it('clamps to the remaining cap', () => {
    expect(computeMatchAmount({ donationCents: 5000, matchRatio: 1, minDonationCents: 0, remainingCapCents: 3000 })).toBe(3000);
  });
  it('returns 0 when the cap is exhausted', () => {
    expect(computeMatchAmount({ donationCents: 5000, matchRatio: 1, minDonationCents: 0, remainingCapCents: 0 })).toBe(0);
  });
  it('handles fractional ratios and rounds', () => {
    expect(computeMatchAmount({ donationCents: 333, matchRatio: 0.5, minDonationCents: 0, remainingCapCents: Infinity })).toBe(167);
  });
});

describe('remainingCap', () => {
  it('treats a 0 cap as uncapped (Infinity)', () => {
    expect(remainingCap(0, 5000)).toBe(Number.POSITIVE_INFINITY);
  });
  it('subtracts used from the cap and never goes negative', () => {
    expect(remainingCap(10000, 3000)).toBe(7000);
    expect(remainingCap(10000, 12000)).toBe(0);
  });
});

describe('categoryEligible', () => {
  it('allows everything when no categories are set', () => {
    expect(categoryEligible([], 'Medical')).toBe(true);
    expect(categoryEligible([], null)).toBe(true);
  });
  it('matches case-insensitively against the allow-list', () => {
    expect(categoryEligible(['Education', 'Medical'], 'medical')).toBe(true);
    expect(categoryEligible(['Education'], 'Sports')).toBe(false);
    expect(categoryEligible(['Education'], null)).toBe(false);
  });
});

describe('isAcceptingClaims', () => {
  it('accepts only active programs', () => {
    expect(isAcceptingClaims({ status: 'active' })).toBe(true);
    expect(isAcceptingClaims({ status: 'paused' })).toBe(false);
    expect(isAcceptingClaims({ status: 'closed' })).toBe(false);
  });
});

describe('claim state machine', () => {
  it('lets a sponsor approve/decline a pending claim', () => {
    expect(canTransitionClaim('sponsor', 'pending', 'approved')).toBe(true);
    expect(canTransitionClaim('sponsor', 'pending', 'declined')).toBe(true);
  });
  it('lets a sponsor mark an approved claim paid', () => {
    expect(canTransitionClaim('sponsor', 'approved', 'paid')).toBe(true);
  });
  it('gives an employee no status transitions', () => {
    expect(canTransitionClaim('employee', 'pending', 'approved')).toBe(false);
    expect(canTransitionClaim('employee', 'pending', 'declined')).toBe(false);
  });
  it('forbids reviving a terminal claim', () => {
    expect(canTransitionClaim('sponsor', 'declined', 'approved')).toBe(false);
    expect(canTransitionClaim('sponsor', 'paid', 'approved')).toBe(false);
  });
});

describe('reservesCap', () => {
  const cases: [ClaimStatus, boolean][] = [
    ['pending', false],
    ['approved', true],
    ['paid', true],
    ['declined', false],
  ];
  it.each(cases)('%s reserves cap = %s', (status, expected) => {
    expect(reservesCap(status)).toBe(expected);
  });
});

describe('validation schemas', () => {
  it('accepts a valid program and defaults ratio to 1', () => {
    const r = ProgramCreateSchema.safeParse({ company_name: 'Acme Corp' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.match_ratio).toBe(1);
  });
  it('rejects a non-positive ratio', () => {
    expect(ProgramCreateSchema.safeParse({ company_name: 'Acme', match_ratio: 0 }).success).toBe(false);
  });
  it('rejects a claim with a non-positive donation amount', () => {
    expect(ClaimCreateSchema.safeParse({ program_id: crypto.randomUUID(), donation_amount_cents: 0 }).success).toBe(false);
    expect(ClaimCreateSchema.safeParse({ program_id: crypto.randomUUID(), donation_amount_cents: 2500 }).success).toBe(true);
  });
});

// ── RLS policy logic simulation ───────────────────────────────────────────────
describe('matching_claims RLS: read scope', () => {
  function canRead(
    claim: { employee_id: string; sponsor_id: string },
    uid: string | null,
    isAdmin: boolean,
  ): boolean {
    return claim.employee_id === uid || isAdmin || claim.sponsor_id === uid;
  }
  it('the employee can read their own claim', () => {
    expect(canRead({ employee_id: 'e1', sponsor_id: 's1' }, 'e1', false)).toBe(true);
  });
  it('the program sponsor can read claims to their program', () => {
    expect(canRead({ employee_id: 'e1', sponsor_id: 's1' }, 's1', false)).toBe(true);
  });
  it('an unrelated user cannot read the claim', () => {
    expect(canRead({ employee_id: 'e1', sponsor_id: 's1' }, 'stranger', false)).toBe(false);
  });
});

describe('summarizeProgramClaims (CSR dashboard)', () => {
  const claims: { status: ClaimStatus; match_amount_cents: number }[] = [
    { status: 'pending',  match_amount_cents: 1000 },
    { status: 'pending',  match_amount_cents: 500 },
    { status: 'approved', match_amount_cents: 2000 },
    { status: 'paid',     match_amount_cents: 3000 },
    { status: 'declined', match_amount_cents: 9999 },
  ];

  it('counts each status', () => {
    const s = summarizeProgramClaims(claims);
    expect(s.total).toBe(5);
    expect(s.pending).toBe(2);
    expect(s.approved).toBe(1);
    expect(s.paid).toBe(1);
    expect(s.declined).toBe(1);
  });

  it('committed = approved + paid match; paid = paid only', () => {
    const s = summarizeProgramClaims(claims);
    expect(s.committedCents).toBe(5000); // 2000 + 3000
    expect(s.paidCents).toBe(3000);
  });

  it('pendingRequestedCents sums only pending claims; declined never counts', () => {
    const s = summarizeProgramClaims(claims);
    expect(s.pendingRequestedCents).toBe(1500); // 1000 + 500
  });

  it('handles an empty program', () => {
    const s = summarizeProgramClaims([]);
    expect(s).toEqual({ total: 0, pending: 0, approved: 0, paid: 0, declined: 0, committedCents: 0, paidCents: 0, pendingRequestedCents: 0 });
  });
});
