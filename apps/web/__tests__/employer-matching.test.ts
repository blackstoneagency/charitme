import { describe, it, expect } from 'vitest';
import {
  searchEmployerMatch,
  EMPLOYER_MATCH_DATABASE,
  parseMatchRatio,
  estimateEmployerMatch,
} from '../lib/employer-matching';

describe('searchEmployerMatch', () => {
  it('returns nothing for queries shorter than 2 normalized chars', () => {
    expect(searchEmployerMatch('')).toEqual([]);
    expect(searchEmployerMatch('a')).toEqual([]);
    expect(searchEmployerMatch('  ')).toEqual([]);
    expect(searchEmployerMatch('!')).toEqual([]); // normalizes to ''
  });

  it('matches case-insensitively', () => {
    const names = searchEmployerMatch('microsoft').map((e) => e.name);
    expect(names).toContain('Microsoft');
    expect(searchEmployerMatch('MICROSOFT').map((e) => e.name)).toContain('Microsoft');
  });

  it('ignores punctuation and whitespace in both query and names', () => {
    // normalize strips non-alphanumerics, so "h-p" matches "HP", "h.p." too
    const hp = searchEmployerMatch('h-p').map((e) => e.name);
    expect(hp).toContain('HP');
  });

  it('does substring (contains) matching, not just prefix', () => {
    const results = searchEmployerMatch('cro'); // inside "Microsoft"
    expect(results.map((e) => e.name)).toContain('Microsoft');
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchEmployerMatch('zzzzzznotacompany')).toEqual([]);
  });

  it('respects the limit and defaults to 8', () => {
    // "a" appears in many names; use a common bigram to get many hits
    const many = searchEmployerMatch('a', 100); // 'a' alone is < 2 chars → []
    expect(many).toEqual([]);
    const capped = searchEmployerMatch('in', 3); // Intel, Cisco?, etc.
    expect(capped.length).toBeLessThanOrEqual(3);
  });

  it('every returned entry actually contains the normalized query', () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const e of searchEmployerMatch('or', 50)) {
      expect(norm(e.name)).toContain('or');
    }
  });

  it('returned entries are real records from the database', () => {
    for (const e of searchEmployerMatch('goog')) {
      expect(EMPLOYER_MATCH_DATABASE).toContainEqual(e);
      expect(e.typicalRatio).toBeTruthy();
    }
  });

  it('database entries all have a name and a typicalRatio', () => {
    expect(EMPLOYER_MATCH_DATABASE.length).toBeGreaterThan(0);
    for (const e of EMPLOYER_MATCH_DATABASE) {
      expect(e.name.trim().length).toBeGreaterThan(0);
      expect(e.typicalRatio.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('parseMatchRatio', () => {
  it('parses "Up to 1:1" as a 1x ceiling', () => {
    expect(parseMatchRatio('Up to 1:1')).toEqual({ multiplier: 1, isCeiling: true, label: 'Up to 1:1' });
  });

  it('parses higher ratios ("Up to 3:1" → 3x)', () => {
    expect(parseMatchRatio('Up to 3:1')?.multiplier).toBe(3);
    expect(parseMatchRatio('Up to 2:1')?.multiplier).toBe(2);
  });

  it('parses a plain (non-ceiling) ratio', () => {
    const r = parseMatchRatio('2:1');
    expect(r?.multiplier).toBe(2);
    expect(r?.isCeiling).toBe(false);
  });

  it('handles fractional ratios and divisors', () => {
    expect(parseMatchRatio('1:2')?.multiplier).toBe(0.5);
    expect(parseMatchRatio('0.5:1')?.multiplier).toBe(0.5);
  });

  it('returns null for unparseable or zero-divisor input', () => {
    expect(parseMatchRatio('')).toBeNull();
    expect(parseMatchRatio('no ratio here')).toBeNull();
    expect(parseMatchRatio('1:0')).toBeNull();
  });

  it('every database ratio is parseable', () => {
    for (const e of EMPLOYER_MATCH_DATABASE) {
      expect(parseMatchRatio(e.typicalRatio), e.name).not.toBeNull();
    }
  });
});

describe('estimateEmployerMatch', () => {
  it('doubles a $50 gift at a 1:1 match', () => {
    const est = estimateEmployerMatch(5000, { typicalRatio: 'Up to 1:1' });
    expect(est).not.toBeNull();
    expect(est!.matchedCents).toBe(5000);
    expect(est!.totalImpactCents).toBe(10000);
    expect(est!.isCeiling).toBe(true);
    expect(est!.capped).toBe(false);
  });

  it('applies a 3:1 multiplier', () => {
    const est = estimateEmployerMatch(10000, { typicalRatio: 'Up to 3:1' });
    expect(est!.matchedCents).toBe(30000);
    expect(est!.totalImpactCents).toBe(40000);
  });

  it('caps the matched amount and flags it', () => {
    const est = estimateEmployerMatch(10000, { typicalRatio: 'Up to 3:1' }, 15000);
    expect(est!.matchedCents).toBe(15000); // raw 30000 capped to 15000
    expect(est!.capped).toBe(true);
    expect(est!.totalImpactCents).toBe(25000);
  });

  it('does not flag capped when the cap is not binding', () => {
    const est = estimateEmployerMatch(5000, { typicalRatio: 'Up to 1:1' }, 999999);
    expect(est!.matchedCents).toBe(5000);
    expect(est!.capped).toBe(false);
  });

  it('rounds to whole cents and never goes negative', () => {
    expect(estimateEmployerMatch(333, { typicalRatio: '0.5:1' })!.matchedCents).toBe(167); // round(166.5)
    const neg = estimateEmployerMatch(-100, { typicalRatio: 'Up to 1:1' })!;
    expect(neg.donationCents).toBe(0);
    expect(neg.matchedCents).toBe(0);
  });

  it('returns null when the ratio is unparseable', () => {
    expect(estimateEmployerMatch(5000, { typicalRatio: 'varies' })).toBeNull();
  });
});
