import { describe, it, expect } from 'vitest';
import {
  scoreGrantMatch,
  rankGrantMatches,
  grantApplicationStatusLabel,
  GrantSearchSchema,
  GrantApplicationCreateSchema,
  GrantApplicationUpdateSchema,
  GrantMatchRequestSchema,
  type Grant,
} from '../lib/grants';

function grant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000001',
    slug: 'test-grant',
    title: 'Community Health Fund',
    funder_name: 'Wellness Foundation',
    funder_type: 'foundation',
    summary: 'Supports community health clinics and outreach programs.',
    description: null,
    category: 'health',
    focus_areas: ['health', 'community'],
    eligibility: 'Registered nonprofits serving underserved communities.',
    eligible_entity_types: ['nonprofit'],
    amount_min: 500_00,
    amount_max: 50_000_00,
    currency: 'USD',
    location: 'United States',
    country: 'US',
    application_url: null,
    deadline_at: null,
    rolling_deadline: false,
    status: 'open',
    verified: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('scoreGrantMatch', () => {
  it('scores a strong all-around match highly', () => {
    const r = scoreGrantMatch(grant(), {
      category: 'health',
      focusAreas: ['health', 'community'],
      entityType: 'nonprofit',
      amountNeeded: 10_000_00,
      country: 'US',
      keywords: 'clinics outreach',
      limit: 10,
    });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('is case-insensitive on category and entity type', () => {
    const r = scoreGrantMatch(grant(), { category: 'HEALTH', entityType: 'Nonprofit', limit: 10 });
    expect(r.score).toBeGreaterThanOrEqual(50); // 30 category + 20 eligibility
  });

  it('gives partial credit when eligibility is unspecified', () => {
    const r = scoreGrantMatch(grant({ eligible_entity_types: [] }), { entityType: 'individual', limit: 10 });
    expect(r.score).toBe(8);
    expect(r.reasons.join(' ')).toMatch(/open to all/i);
  });

  it('does not award amount points when need exceeds the ceiling', () => {
    const r = scoreGrantMatch(grant({ amount_max: 1_000_00 }), { amountNeeded: 5_000_00, limit: 10 });
    expect(r.reasons.join(' ')).toMatch(/ceiling below/i);
    expect(r.score).toBe(0);
  });

  it('floors closed grants to zero', () => {
    const r = scoreGrantMatch(grant({ status: 'closed' }), { category: 'health', limit: 10 });
    expect(r.score).toBe(0);
  });

  it('never exceeds 100', () => {
    const r = scoreGrantMatch(grant(), {
      category: 'health', focusAreas: ['health', 'community', 'health', 'community'],
      entityType: 'nonprofit', amountNeeded: 1_000_00, country: 'US', keywords: 'community health clinics outreach programs', limit: 10,
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('rankGrantMatches', () => {
  it('drops zero-score grants, sorts desc, and respects limit', () => {
    const grants = [
      grant({ id: 'a', category: 'health' }),
      grant({ id: 'b', category: 'education', focus_areas: [], eligible_entity_types: ['school'] }),
      grant({ id: 'c', category: 'health', focus_areas: ['health'] }),
    ];
    const ranked = rankGrantMatches(grants, { category: 'health', focusAreas: ['health'], limit: 2 });
    expect(ranked.length).toBeLessThanOrEqual(2);
    expect(ranked.every((m) => m.score > 0)).toBe(true);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    expect(ranked.map((m) => m.grantId)).not.toContain('b');
  });
});

describe('grantApplicationStatusLabel', () => {
  it('maps every status to a human label', () => {
    expect(grantApplicationStatusLabel('draft')).toBe('Draft');
    expect(grantApplicationStatusLabel('awarded')).toBe('Awarded');
    expect(grantApplicationStatusLabel('rejected')).toBe('Not selected');
    expect(grantApplicationStatusLabel('under_review')).toBe('Under review');
  });
});

describe('validation schemas', () => {
  it('GrantSearchSchema coerces and defaults pagination', () => {
    const parsed = GrantSearchSchema.parse({ q: ' cancer ', limit: '10' });
    expect(parsed.q).toBe('cancer');
    expect(parsed.limit).toBe(10);
    expect(parsed.offset).toBe(0);
  });

  it('GrantSearchSchema rejects an oversized limit', () => {
    expect(GrantSearchSchema.safeParse({ limit: 999 }).success).toBe(false);
  });

  it('GrantApplicationCreateSchema requires a uuid grantId', () => {
    expect(GrantApplicationCreateSchema.safeParse({ grantId: 'not-a-uuid' }).success).toBe(false);
    expect(GrantApplicationCreateSchema.safeParse({ grantId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
  });

  it('GrantApplicationUpdateSchema only permits applicant-side statuses', () => {
    expect(GrantApplicationUpdateSchema.safeParse({ status: 'submitted' }).success).toBe(true);
    expect(GrantApplicationUpdateSchema.safeParse({ status: 'awarded' }).success).toBe(false);
  });

  it('GrantMatchRequestSchema defaults limit to 10', () => {
    expect(GrantMatchRequestSchema.parse({}).limit).toBe(10);
  });
});
