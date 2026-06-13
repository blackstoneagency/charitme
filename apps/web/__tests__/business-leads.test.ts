import { describe, expect, it } from 'vitest';
import {
  scoreLead,
  parseEnrichment,
  fallbackEnrichment,
  shouldAlertAdmin,
  generateSampleFilings,
  isValidEmail,
  normalizePhone,
  normalizeWebsite,
  normalizeEntityType,
  normalizeState,
  buildIncorporationDateFilter,
  ALERT_SCORE_THRESHOLD,
  type BusinessLeadInput,
} from '../lib/business-leads';

// This suite is the pipeline's "API test" — it exercises every pure unit the
// /api/admin/new-customers routes depend on (scoring, enrichment parsing,
// fallback, alert threshold, sample source). The route-level /test endpoint
// reuses these same functions, so green here means the API logic is sound.

const TODAY = new Date('2026-06-12T00:00:00Z');

describe('scoreLead', () => {
  it('scores a fully-contactable, fresh, on-target lead as grade A and alert-worthy', () => {
    const lead: BusinessLeadInput = {
      business_name: 'Riverside Community Foundation LLC',
      entity_type: 'LLC',
      state: 'DE',
      filing_date: '2026-06-01',
      website: 'https://riversidecf.org',
      email: 'info@riversidecf.org',
      phone: '(302) 555-0148',
      owner_name: 'Jane Doe',
      address: 'Wilmington, DE',
      industry: 'Nonprofit',
    };
    const { score, grade, breakdown } = scoreLead(lead, TODAY);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(grade).toBe('A');
    expect(breakdown.website).toBe(20);
    expect(breakdown.email).toBe(25);
    expect(breakdown.phone).toBe(15);
    expect(breakdown.industry).toBe(10);
    expect(shouldAlertAdmin(score)).toBe(true);
  });

  it('scores a bare filing with no contact info low and not alert-worthy', () => {
    const lead: BusinessLeadInput = {
      business_name: 'Generic Holdings LLC',
      entity_type: 'LLC',
      state: 'WY',
      filing_date: '2026-06-10',
    };
    const { score, grade } = scoreLead(lead, TODAY);
    expect(score).toBeLessThan(ALERT_SCORE_THRESHOLD);
    expect(['C', 'D']).toContain(grade);
    expect(shouldAlertAdmin(score)).toBe(false);
  });

  it('is deterministic for the same input', () => {
    const lead: BusinessLeadInput = { business_name: 'Acme LLC', entity_type: 'LLC', state: 'CA', filing_date: '2026-05-20' };
    expect(scoreLead(lead, TODAY)).toEqual(scoreLead(lead, TODAY));
  });

  it('decays recency points as the filing ages', () => {
    const base: BusinessLeadInput = { business_name: 'Time Co LLC', entity_type: 'LLC', state: 'TX' };
    const fresh = scoreLead({ ...base, filing_date: '2026-06-01' }, TODAY).breakdown.recency;   // ~11d
    const mid = scoreLead({ ...base, filing_date: '2026-04-20' }, TODAY).breakdown.recency;     // ~53d
    const old = scoreLead({ ...base, filing_date: '2025-12-01' }, TODAY).breakdown.recency;     // >120d
    expect(fresh).toBe(15);
    expect(mid).toBe(10);
    expect(old).toBe(0);
  });

  it('never exceeds 100', () => {
    const lead: BusinessLeadInput = {
      business_name: 'Maxed Nonprofit Foundation LLC',
      entity_type: 'Nonprofit',
      state: 'NY',
      filing_date: TODAY.toISOString().slice(0, 10),
      website: 'https://max.org', email: 'a@max.org', phone: '212-555-1212',
      owner_name: 'X', address: 'NYC', industry: 'charity',
    };
    expect(scoreLead(lead, TODAY).score).toBeLessThanOrEqual(100);
  });
});

describe('contact validation/normalization', () => {
  it('validates emails', () => {
    expect(isValidEmail('info@acme.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it('normalizes valid NANP phones and rejects junk', () => {
    expect(normalizePhone('3025550148')).toBe('(302) 555-0148');
    expect(normalizePhone('+1 (302) 555-0148')).toBe('(302) 555-0148');
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('normalizes websites to a bare https domain', () => {
    expect(normalizeWebsite('acme.com')).toBe('https://acme.com');
    expect(normalizeWebsite('http://www.acme.com/path?x=1')).toBe('https://acme.com');
    expect(normalizeWebsite('not a url')).toBeNull();
  });

  it('normalizes entity types', () => {
    expect(normalizeEntityType('limited liability company')).toBe('LLC');
    expect(normalizeEntityType('Some Nonprofit Corp')).toBe('Nonprofit');
    expect(normalizeEntityType('Inc.')).toBe('Corporation');
  });

  it('normalizes 2-letter state codes', () => {
    expect(normalizeState('de')).toBe('DE');
    expect(normalizeState('California')).toBe('California');
  });
});

describe('parseEnrichment', () => {
  it('keeps a valid website, drops a malformed email and short phone', () => {
    const out = parseEnrichment({ website: 'acme.com', email: 'nope', phone: '123', notes: ' hi ' });
    expect(out.website).toBe('https://acme.com');
    expect(out.email).toBeNull();
    expect(out.phone).toBeNull();
    expect(out.notes).toBe('hi');
  });

  it('handles non-object / null input safely', () => {
    expect(parseEnrichment(null)).toEqual({ website: null, email: null, phone: null, notes: null });
    expect(parseEnrichment('garbage')).toEqual({ website: null, email: null, phone: null, notes: null });
  });

  it('lowercases a valid email', () => {
    expect(parseEnrichment({ email: 'Info@Acme.COM' }).email).toBe('info@acme.com');
  });
});

describe('fallbackEnrichment', () => {
  it('guesses a domain from the business name but never fabricates contact info', () => {
    const out = fallbackEnrichment({ business_name: 'Riverside Community Foundation LLC' });
    expect(out.website).toBe('https://riversidecommunityfoundation.com');
    expect(out.email).toBeNull();
    expect(out.phone).toBeNull();
  });

  it('preserves known-good contact info passed in', () => {
    const out = fallbackEnrichment({ business_name: 'Acme LLC', email: 'x@acme.com', phone: '3025550148' });
    expect(out.email).toBe('x@acme.com');
    expect(out.phone).toBe('(302) 555-0148');
  });
});

describe('buildIncorporationDateFilter', () => {
  it('builds an exact-date filter when from === to', () => {
    expect(buildIncorporationDateFilter('2026-06-12', '2026-06-12')).toBe('2026-06-12');
  });

  it('builds a range filter when from and to differ', () => {
    expect(buildIncorporationDateFilter('2026-06-01', '2026-06-12')).toBe('2026-06-01:2026-06-12');
  });

  it('builds an open-ended "after" filter when only from is given', () => {
    expect(buildIncorporationDateFilter('2026-06-01', null)).toBe('2026-06-01:');
    expect(buildIncorporationDateFilter('2026-06-01')).toBe('2026-06-01:');
  });

  it('builds an open-ended "before" filter when only to is given', () => {
    expect(buildIncorporationDateFilter(null, '2026-06-12')).toBe(':2026-06-12');
    expect(buildIncorporationDateFilter(undefined, '2026-06-12')).toBe(':2026-06-12');
  });

  it('returns null when neither bound is a valid date', () => {
    expect(buildIncorporationDateFilter(null, null)).toBeNull();
    expect(buildIncorporationDateFilter(undefined, undefined)).toBeNull();
    expect(buildIncorporationDateFilter('not-a-date', 'also-bad')).toBeNull();
  });

  it('ignores an invalid bound and uses only the valid one', () => {
    expect(buildIncorporationDateFilter('bad', '2026-06-12')).toBe(':2026-06-12');
    expect(buildIncorporationDateFilter('2026-06-01', 'bad')).toBe('2026-06-01:');
  });
});

describe('generateSampleFilings', () => {
  it('produces the requested count of valid, de-duplicated filings', () => {
    const filings = generateSampleFilings(8, 999);
    expect(filings).toHaveLength(8);
    for (const f of filings) {
      expect(f.business_name.length).toBeGreaterThan(0);
      expect(f.state).toBeTruthy();
      expect(f.entity_type).toBe('LLC');
      expect(f.source).toBe('sample');
    }
    const keys = filings.map((f) => `${f.business_name}|${f.state}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is deterministic for a fixed seed', () => {
    expect(generateSampleFilings(5, 42)).toEqual(generateSampleFilings(5, 42));
  });
});
