import { describe, it, expect } from 'vitest';
import {
  scoreVolunteerMatch,
  rankVolunteerMatches,
  canTransitionApplication,
  orgDecisionsFrom,
  applicationSlotDelta,
  volunteerApplicationStatusLabel,
  hasOpenSlots,
  OpportunitySearchSchema,
  VolunteerMatchRequestSchema,
  type VolunteerOpportunity,
} from '../lib/volunteers';

function opp(overrides: Partial<VolunteerOpportunity> = {}): VolunteerOpportunity {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000001',
    slug: 'food-bank-helper',
    title: 'Food Bank Distribution Helper',
    org_name: 'City Food Bank',
    summary: 'Help pack and distribute food boxes to families in need.',
    description: null,
    category: 'community',
    skills: ['logistics', 'customer service'],
    location: 'Austin, TX',
    country: 'US',
    is_remote: false,
    starts_at: null,
    ends_at: null,
    slots: 10,
    slots_filled: 3,
    time_commitment: '4 hrs/week',
    contact_url: null,
    status: 'open',
    verified: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('scoreVolunteerMatch', () => {
  it('scores a strong skill + category + geo match highly', () => {
    const r = scoreVolunteerMatch(opp(), {
      skills: ['logistics', 'customer service'], category: 'community', country: 'US', keywords: 'families food', limit: 10,
    });
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it('is case-insensitive on skills and category', () => {
    const r = scoreVolunteerMatch(opp(), { skills: ['LOGISTICS'], category: 'Community', limit: 10 });
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it('rewards remote-friendly roles when volunteer is remote-ok', () => {
    const r = scoreVolunteerMatch(opp({ is_remote: true, country: null }), { remoteOk: true, limit: 10 });
    expect(r.reasons.join(' ')).toMatch(/remote/i);
    expect(r.score).toBeGreaterThanOrEqual(20);
  });

  it('gives partial credit when no skills are required', () => {
    const r = scoreVolunteerMatch(opp({ skills: [] }), { skills: ['anything'], limit: 10 });
    expect(r.score).toBeGreaterThanOrEqual(10);
    expect(r.reasons.join(' ')).toMatch(/no specific skills/i);
  });

  it('floors closed opportunities to zero', () => {
    const r = scoreVolunteerMatch(opp({ status: 'closed' }), { category: 'community', limit: 10 });
    expect(r.score).toBe(0);
  });

  it('never exceeds 100', () => {
    const r = scoreVolunteerMatch(opp({ is_remote: true }), {
      skills: ['logistics', 'customer service', 'logistics'], category: 'community', country: 'US', remoteOk: true, keywords: 'food families distribute boxes', limit: 10,
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('rankVolunteerMatches', () => {
  it('drops zero-score, sorts desc, respects limit', () => {
    const list = [
      opp({ id: 'a', category: 'community', skills: ['logistics'] }),
      opp({ id: 'b', category: 'education', skills: ['teaching'], is_remote: false, country: 'CA' }),
      opp({ id: 'c', category: 'community', skills: ['logistics', 'customer service'] }),
    ];
    const ranked = rankVolunteerMatches(list, { skills: ['logistics'], category: 'community', country: 'US', limit: 2 });
    expect(ranked.length).toBeLessThanOrEqual(2);
    expect(ranked.every((m) => m.score > 0)).toBe(true);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    expect(ranked.map((m) => m.opportunityId)).not.toContain('b');
  });
});

describe('hasOpenSlots', () => {
  it('true when unlimited or under capacity, false when full', () => {
    expect(hasOpenSlots({ slots: null, slots_filled: 100 })).toBe(true);
    expect(hasOpenSlots({ slots: 10, slots_filled: 3 })).toBe(true);
    expect(hasOpenSlots({ slots: 10, slots_filled: 10 })).toBe(false);
  });
});

describe('volunteerApplicationStatusLabel', () => {
  it('maps statuses to labels', () => {
    expect(volunteerApplicationStatusLabel('applied')).toBe('Applied');
    expect(volunteerApplicationStatusLabel('declined')).toBe('Not selected');
    expect(volunteerApplicationStatusLabel('completed')).toBe('Completed');
  });
});

describe('application status machine', () => {
  it('lets an org accept or decline a new application', () => {
    expect(canTransitionApplication('applied', 'accepted', 'org')).toBe(true);
    expect(canTransitionApplication('applied', 'declined', 'org')).toBe(true);
    expect(orgDecisionsFrom('applied').sort()).toEqual(['accepted', 'declined']);
  });

  it('lets an org decline or complete an accepted volunteer', () => {
    expect(canTransitionApplication('accepted', 'completed', 'org')).toBe(true);
    expect(canTransitionApplication('accepted', 'declined', 'org')).toBe(true);
    expect(orgDecisionsFrom('accepted').sort()).toEqual(['completed', 'declined']);
  });

  it('lets an applicant withdraw before or after acceptance', () => {
    expect(canTransitionApplication('applied', 'withdrawn', 'applicant')).toBe(true);
    expect(canTransitionApplication('accepted', 'withdrawn', 'applicant')).toBe(true);
  });

  it('forbids cross-actor and illegal moves', () => {
    expect(canTransitionApplication('applied', 'accepted', 'applicant')).toBe(false); // applicant can't self-accept
    expect(canTransitionApplication('applied', 'withdrawn', 'org')).toBe(false);      // org can't withdraw
    expect(canTransitionApplication('applied', 'completed', 'org')).toBe(false);      // must accept first
    expect(canTransitionApplication('declined', 'accepted', 'org')).toBe(false);      // terminal
    expect(canTransitionApplication('withdrawn', 'accepted', 'org')).toBe(false);     // terminal
    expect(canTransitionApplication('applied', 'applied', 'org')).toBe(false);        // no-op
    expect(orgDecisionsFrom('withdrawn')).toEqual([]);
  });

  it('computes slot deltas: fill on accept, free on leaving accepted', () => {
    expect(applicationSlotDelta('applied', 'accepted')).toBe(1);
    expect(applicationSlotDelta('accepted', 'declined')).toBe(-1);
    expect(applicationSlotDelta('accepted', 'completed')).toBe(-1);
    expect(applicationSlotDelta('accepted', 'withdrawn')).toBe(-1);
    expect(applicationSlotDelta('applied', 'declined')).toBe(0);
    expect(applicationSlotDelta('applied', 'withdrawn')).toBe(0);
  });
});

describe('schemas', () => {
  it('OpportunitySearchSchema coerces limit and rejects oversize', () => {
    expect(OpportunitySearchSchema.parse({ limit: '10' }).limit).toBe(10);
    expect(OpportunitySearchSchema.safeParse({ limit: 999 }).success).toBe(false);
  });
  it('VolunteerMatchRequestSchema defaults limit to 10', () => {
    expect(VolunteerMatchRequestSchema.parse({}).limit).toBe(10);
  });
});
