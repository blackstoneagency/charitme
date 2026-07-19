import { describe, expect, it } from 'vitest';
import {
  canTransitionMatchingGift,
  estimateMatchCents,
  estimateMatchForEmployer,
  isMatchingGiftStatus,
  matchingGiftStatusLabel,
  parseMatchRatio,
  MATCHING_GIFT_STATUSES,
} from '../lib/matching-gifts';

describe('parseMatchRatio', () => {
  it('parses simple 1:1', () => {
    expect(parseMatchRatio('Up to 1:1')).toBe(1);
  });
  it('parses higher ratios', () => {
    expect(parseMatchRatio('Up to 2:1')).toBe(2);
    expect(parseMatchRatio('Up to 3:1')).toBe(3);
  });
  it('tolerates spacing and bare ratios', () => {
    expect(parseMatchRatio('2 : 1')).toBe(2);
    expect(parseMatchRatio('1:1')).toBe(1);
  });
  it('handles fractional ratios', () => {
    expect(parseMatchRatio('1:2')).toBe(0.5);
  });
  it('returns 0 for unparseable / empty input', () => {
    expect(parseMatchRatio('varies by team')).toBe(0);
    expect(parseMatchRatio('')).toBe(0);
    expect(parseMatchRatio(null)).toBe(0);
    expect(parseMatchRatio(undefined)).toBe(0);
    expect(parseMatchRatio('1:0')).toBe(0); // no divide-by-zero
  });
});

describe('estimateMatchCents', () => {
  it('multiplies donation by ratio and rounds', () => {
    expect(estimateMatchCents(10_000, 1)).toBe(10_000);
    expect(estimateMatchCents(10_000, 2)).toBe(20_000);
    expect(estimateMatchCents(3_333, 0.5)).toBe(1_667); // rounds 1666.5
  });
  it('is 0 for non-positive inputs', () => {
    expect(estimateMatchCents(0, 1)).toBe(0);
    expect(estimateMatchCents(10_000, 0)).toBe(0);
    expect(estimateMatchCents(-100, 1)).toBe(0);
    expect(estimateMatchCents(10_000, -1)).toBe(0);
  });
});

describe('estimateMatchForEmployer', () => {
  it('matches a known 1:1 employer exactly', () => {
    const e = estimateMatchForEmployer(5_000, 'Microsoft');
    expect(e.matched).toBe(true);
    expect(e.ratio).toBe(1);
    expect(e.estimatedMatchCents).toBe(5_000);
  });
  it('matches a known higher-ratio employer', () => {
    const e = estimateMatchForEmployer(5_000, 'Lockheed Martin');
    expect(e.matched).toBe(true);
    expect(e.ratio).toBe(3);
    expect(e.estimatedMatchCents).toBe(15_000);
  });
  it('is case-insensitive and trims', () => {
    const e = estimateMatchForEmployer(1_000, '  google  ');
    expect(e.matched).toBe(true);
    expect(e.employer?.name).toBe('Google');
  });
  it('returns unmatched with 0 estimate for unknown employers', () => {
    const e = estimateMatchForEmployer(5_000, 'Some Local Coffee Shop LLC');
    expect(e.matched).toBe(false);
    expect(e.employer).toBeNull();
    expect(e.estimatedMatchCents).toBe(0);
  });
});

describe('canTransitionMatchingGift (state machine)', () => {
  it('allows the documented forward transitions', () => {
    expect(canTransitionMatchingGift('submitted', 'requested_from_employer')).toBe(true);
    expect(canTransitionMatchingGift('requested_from_employer', 'approved')).toBe(true);
    expect(canTransitionMatchingGift('approved', 'received')).toBe(true);
    expect(canTransitionMatchingGift('submitted', 'cancelled')).toBe(true);
  });
  it('treats same-status as an allowed no-op', () => {
    expect(canTransitionMatchingGift('approved', 'approved')).toBe(true);
  });
  it('blocks skipping backwards and out of terminal states', () => {
    expect(canTransitionMatchingGift('received', 'submitted')).toBe(false);
    expect(canTransitionMatchingGift('declined', 'approved')).toBe(false);
    expect(canTransitionMatchingGift('cancelled', 'submitted')).toBe(false);
    expect(canTransitionMatchingGift('approved', 'submitted')).toBe(false);
  });
});

describe('status helpers', () => {
  it('validates known statuses', () => {
    expect(isMatchingGiftStatus('approved')).toBe(true);
    expect(isMatchingGiftStatus('nope')).toBe(false);
    expect(isMatchingGiftStatus(42)).toBe(false);
  });
  it('has a human label for every status', () => {
    for (const s of MATCHING_GIFT_STATUSES) {
      expect(matchingGiftStatusLabel(s)).toBeTruthy();
    }
  });
});
