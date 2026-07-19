import { describe, expect, it } from 'vitest';
import {
  computeMatchedCents,
  emailDomain,
  emailMatchesDomain,
  resolveCorporateMatch,
  selectRule,
  type MatchingGiftRule,
} from '../lib/corporate';

const rule = (over: Partial<MatchingGiftRule> = {}): MatchingGiftRule => ({
  category: null,
  ratio: 1,
  perGiftCapCents: null,
  annualCapCents: null,
  active: true,
  ...over,
});

describe('email domain helpers', () => {
  it('extracts + lowercases domain', () => {
    expect(emailDomain('Jane@Acme.com')).toBe('acme.com');
    expect(emailDomain('no-at-sign')).toBeNull();
    expect(emailDomain(null)).toBeNull();
  });
  it('matches account domain case-insensitively', () => {
    expect(emailMatchesDomain('a@acme.com', 'ACME.com')).toBe(true);
    expect(emailMatchesDomain('a@other.com', 'acme.com')).toBe(false);
    expect(emailMatchesDomain('a@acme.com', null)).toBe(false);
  });
});

describe('selectRule (specificity)', () => {
  const rules = [rule({ category: null, ratio: 1 }), rule({ category: 'medical', ratio: 2 })];
  it('prefers category-specific rule', () => {
    expect(selectRule(rules, 'medical')?.ratio).toBe(2);
  });
  it('falls back to catch-all', () => {
    expect(selectRule(rules, 'education')?.ratio).toBe(1);
  });
  it('ignores inactive rules', () => {
    expect(selectRule([rule({ category: 'medical', ratio: 2, active: false })], 'medical')).toBeNull();
  });
});

describe('computeMatchedCents (caps)', () => {
  it('applies ratio with no caps', () => {
    const r = computeMatchedCents({ donationCents: 10_000, ratio: 2 });
    expect(r.matchedCents).toBe(20_000);
    expect(r.capped).toBe(false);
  });
  it('applies per-gift cap', () => {
    const r = computeMatchedCents({ donationCents: 10_000, ratio: 2, perGiftCapCents: 15_000 });
    expect(r.matchedCents).toBe(15_000);
    expect(r.cappedBy).toBe('per_gift');
  });
  it('applies annual cap net of prior matches', () => {
    const r = computeMatchedCents({ donationCents: 10_000, ratio: 1, annualCapCents: 25_000, priorMatchedThisYearCents: 20_000 });
    expect(r.matchedCents).toBe(5_000);
    expect(r.cappedBy).toBe('annual');
  });
  it('returns 0 when annual cap already exhausted', () => {
    const r = computeMatchedCents({ donationCents: 10_000, ratio: 1, annualCapCents: 10_000, priorMatchedThisYearCents: 10_000 });
    expect(r.matchedCents).toBe(0);
  });
  it('is 0 for non-positive inputs', () => {
    expect(computeMatchedCents({ donationCents: 0, ratio: 1 }).matchedCents).toBe(0);
    expect(computeMatchedCents({ donationCents: 10_000, ratio: 0 }).matchedCents).toBe(0);
  });
});

describe('resolveCorporateMatch', () => {
  const account = { defaultMatchRatio: 1, annualCapCents: null, active: true };
  it('uses a matching rule over the account default', () => {
    const r = resolveCorporateMatch({
      account,
      rules: [rule({ category: 'medical', ratio: 3, perGiftCapCents: 50_000 })],
      donationCents: 20_000,
      category: 'medical',
    });
    expect(r.ratio).toBe(3);
    expect(r.matchedCents).toBe(50_000); // 60k capped to 50k
  });
  it('falls back to account default ratio when no rule matches', () => {
    const r = resolveCorporateMatch({ account, rules: [], donationCents: 5_000, category: 'education' });
    expect(r.ratio).toBe(1);
    expect(r.matchedCents).toBe(5_000);
  });
  it('honours account annual cap when the rule has none', () => {
    const r = resolveCorporateMatch({
      account: { defaultMatchRatio: 1, annualCapCents: 30_000, active: true },
      rules: [rule({ category: null, ratio: 2 })],
      donationCents: 20_000,
      category: null,
      priorMatchedThisYearCents: 20_000,
    });
    expect(r.matchedCents).toBe(10_000); // 40k raw, annual remaining 10k
    expect(r.cappedBy).toBe('annual');
  });
  it('is inactive-safe', () => {
    const r = resolveCorporateMatch({ account: { ...account, active: false }, rules: [], donationCents: 10_000, category: null });
    expect(r.matchedCents).toBe(0);
  });
});
