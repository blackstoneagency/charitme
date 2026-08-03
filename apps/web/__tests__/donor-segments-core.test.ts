import { describe, it, expect } from 'vitest';
import {
  matchesSegment,
  selectMembers,
  isEmptyRuleSet,
  isContradictory,
  isValidRuleSet,
  describeRules,
  parseRules,
  type SegmentContact,
} from '../lib/donor-segments-core';

// ─────────────────────────────────────────────────────────────────────────────
// A segment decides WHO GETS EMAILED. A rule that quietly matches everyone is
// not a cosmetic bug — it is a mailing to the entire contact list — and one that
// quietly matches nobody is a campaign that silently does not happen. Both
// directions are asserted.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-08-02T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const contact = (over: Partial<SegmentContact> = {}): SegmentContact => ({
  id: 'c1',
  email: 'a@b.test',
  full_name: 'Ada',
  tags: [],
  lifetime_value_cents: 0,
  last_donated_at: null,
  consent_email: true,
  consent_sms: false,
  ...over,
});

describe('matchesSegment — tags', () => {
  it('requires ALL listed tags, not any', () => {
    const c = contact({ tags: ['major'] });
    expect(matchesSegment(c, { tags: ['major'] }, NOW)).toBe(true);
    expect(matchesSegment(c, { tags: ['major', 'monthly'] }, NOW)).toBe(false);
  });

  it('compares case-insensitively', () => {
    expect(matchesSegment(contact({ tags: ['Major'] }), { tags: ['major'] }, NOW)).toBe(true);
  });

  it('treats a null tag list as no tags', () => {
    expect(matchesSegment(contact({ tags: null }), { tags: ['major'] }, NOW)).toBe(false);
  });

  it('an empty tag rule imposes nothing', () => {
    expect(matchesSegment(contact({ tags: [] }), { tags: [] }, NOW)).toBe(true);
  });
});

describe('matchesSegment — lifetime value', () => {
  it('treats the bounds as inclusive', () => {
    const c = contact({ lifetime_value_cents: 500_00 });
    expect(matchesSegment(c, { minLifetimeValueCents: 500_00 }, NOW)).toBe(true);
    expect(matchesSegment(c, { maxLifetimeValueCents: 500_00 }, NOW)).toBe(true);
    expect(matchesSegment(c, { minLifetimeValueCents: 500_01 }, NOW)).toBe(false);
  });

  it('reads a null lifetime value as zero', () => {
    expect(matchesSegment(contact({ lifetime_value_cents: null }), { maxLifetimeValueCents: 0 }, NOW)).toBe(true);
    expect(matchesSegment(contact({ lifetime_value_cents: null }), { minLifetimeValueCents: 1 }, NOW)).toBe(false);
  });

  it('distinguishes a zero floor from no floor', () => {
    // An absent rule means "no criterion"; a 0 floor is a real, permissive rule.
    // Conflating them makes "donors worth over nothing" indistinguishable from
    // "no criterion at all".
    expect(isEmptyRuleSet({ minLifetimeValueCents: 0 })).toBe(false);
    expect(isEmptyRuleSet({})).toBe(true);
  });
});

describe('matchesSegment — recency', () => {
  it('matches a donation inside the window', () => {
    expect(matchesSegment(contact({ last_donated_at: daysAgo(10) }), { donatedWithinDays: 30 }, NOW)).toBe(true);
    expect(matchesSegment(contact({ last_donated_at: daysAgo(40) }), { donatedWithinDays: 30 }, NOW)).toBe(false);
  });

  it('excludes a never-donor from every recency window', () => {
    // A null date treated as 0 would place them in EVERY "donated recently"
    // segment, which is the mailing-list version of the bug.
    expect(matchesSegment(contact({ last_donated_at: null }), { donatedWithinDays: 30 }, NOW)).toBe(false);
  });

  it('includes a never-donor in a lapsed segment', () => {
    // Symmetrically: someone who never gave has, by definition, not given in the
    // last N days. Excluding them would hide exactly the people a re-engagement
    // campaign is for.
    expect(matchesSegment(contact({ last_donated_at: null }), { notDonatedForDays: 90 }, NOW)).toBe(true);
  });

  it('excludes a recent donor from a lapsed segment', () => {
    expect(matchesSegment(contact({ last_donated_at: daysAgo(10) }), { notDonatedForDays: 90 }, NOW)).toBe(false);
    expect(matchesSegment(contact({ last_donated_at: daysAgo(100) }), { notDonatedForDays: 90 }, NOW)).toBe(true);
  });

  it('does not match on an unparseable date', () => {
    expect(matchesSegment(contact({ last_donated_at: 'never' }), { donatedWithinDays: 30 }, NOW)).toBe(false);
  });
});

describe('matchesSegment — consent', () => {
  it('honours the email and SMS gates', () => {
    expect(matchesSegment(contact({ consent_email: false }), { requiresEmailConsent: true }, NOW)).toBe(false);
    expect(matchesSegment(contact({ consent_sms: false }), { requiresSmsConsent: true }, NOW)).toBe(false);
    expect(matchesSegment(contact({ consent_sms: true }), { requiresSmsConsent: true }, NOW)).toBe(true);
  });

  it('imposes no consent rule when not asked for', () => {
    expect(matchesSegment(contact({ consent_email: false, consent_sms: false }), {}, NOW)).toBe(true);
  });
});

describe('matchesSegment — every rule is an AND', () => {
  it('requires all criteria together', () => {
    const c = contact({ tags: ['major'], lifetime_value_cents: 900_00, last_donated_at: daysAgo(5), consent_email: true });
    expect(matchesSegment(c, { tags: ['major'], minLifetimeValueCents: 500_00, donatedWithinDays: 30, requiresEmailConsent: true }, NOW)).toBe(true);
    expect(matchesSegment(c, { tags: ['major'], minLifetimeValueCents: 1_000_00 }, NOW)).toBe(false);
  });

  it('refuses to match on a structurally invalid rule set', () => {
    // A negative "days" is not a rule. Matching everyone would be the dangerous
    // default here.
    expect(matchesSegment(contact(), { donatedWithinDays: -5 }, NOW)).toBe(false);
  });
});

describe('isValidRuleSet / isContradictory', () => {
  it('rejects negatives and non-finite numbers', () => {
    expect(isValidRuleSet({ minLifetimeValueCents: -1 })).toBe(false);
    expect(isValidRuleSet({ donatedWithinDays: Number.NaN })).toBe(false);
    expect(isValidRuleSet({ minLifetimeValueCents: 0 })).toBe(true);
  });

  it('rejects an empty-string tag', () => {
    expect(isValidRuleSet({ tags: ['  '] })).toBe(false);
  });

  it('names rules that are well-formed but can never match', () => {
    // These save happily and then produce an empty segment nobody can explain.
    expect(isContradictory({ minLifetimeValueCents: 500_00, maxLifetimeValueCents: 100_00 })).toBe(true);
    expect(isContradictory({ donatedWithinDays: 30, notDonatedForDays: 7 })).toBe(true);
    expect(isContradictory({ donatedWithinDays: 7, notDonatedForDays: 30 })).toBe(false);
    expect(isContradictory({})).toBe(false);
  });
});

describe('isEmptyRuleSet', () => {
  it('is true only when nothing constrains', () => {
    expect(isEmptyRuleSet({})).toBe(true);
    expect(isEmptyRuleSet({ tags: [] })).toBe(true);
    expect(isEmptyRuleSet({ requiresEmailConsent: true })).toBe(false);
  });

  it('an empty rule set really does match everyone', () => {
    // Stated as a test because it is the risk: a form that drops its inputs
    // produces {} and mails the entire list.
    const everyone = [contact({ id: 'a' }), contact({ id: 'b', consent_email: false })];
    expect(selectMembers(everyone, {}, NOW)).toHaveLength(2);
  });
});

describe('describeRules', () => {
  it('says "Every contact" for an empty set rather than an empty string', () => {
    expect(describeRules({})).toBe('Every contact');
  });

  it('renders each criterion so a saved segment can be read at a glance', () => {
    const text = describeRules({ tags: ['major'], minLifetimeValueCents: 50_000, donatedWithinDays: 30, requiresEmailConsent: true });
    expect(text).toContain('major');
    expect(text).toContain('$500+');
    expect(text).toContain('30 days');
    expect(text).toContain('email');
  });
});

describe('parseRules', () => {
  it('survives arbitrary jsonb', () => {
    expect(parseRules(null)).toEqual({});
    expect(parseRules('nope')).toEqual({});
    expect(parseRules([1, 2])).toEqual({});
    expect(parseRules({ unknown: true })).toEqual({});
  });

  it('drops negatives and blanks rather than trusting the column', () => {
    expect(parseRules({ minLifetimeValueCents: -5 })).toEqual({});
    expect(parseRules({ tags: ['', '  ', 'ok'] })).toEqual({ tags: ['ok'] });
  });

  it('round-trips a real rule set', () => {
    const rules = { tags: ['major'], minLifetimeValueCents: 50_000, donatedWithinDays: 30, requiresEmailConsent: true };
    expect(parseRules(JSON.parse(JSON.stringify(rules)))).toEqual(rules);
  });
});
