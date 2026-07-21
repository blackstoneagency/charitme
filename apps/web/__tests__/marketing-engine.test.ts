import { describe, it, expect } from 'vitest';
import {
  computeLeadScore,
  computeEngagementScore,
  computeChurnRisk,
  classifyClientType,
  computeLifecycleStage,
  matchesSegment,
  marketingStatusForOptIn,
  type ContactSignals,
  type SegmentableContact,
  type SegmentRules,
} from '../lib/marketing-core';

describe('marketingStatusForOptIn', () => {
  it('makes an opted-in donor an active (emailable) contact', () => {
    expect(marketingStatusForOptIn(true)).toBe('active');
  });

  it('makes a non-opted-in donor unsubscribed (never marketed to without consent)', () => {
    expect(marketingStatusForOptIn(false)).toBe('unsubscribed');
  });
});

const base: ContactSignals = {
  donationCount: 0,
  donorValueCents: 0,
  hasRecurring: false,
  campaignsCreated: 0,
  campaignsPublished: 0,
  eventsLast30d: 0,
  daysSinceLastActive: null,
};

describe('computeLeadScore', () => {
  it('scores a brand-new contact at 0', () => {
    expect(computeLeadScore(base)).toBe(0);
  });

  it('scores donors higher than visitors', () => {
    const donor = computeLeadScore({ ...base, donationCount: 1, donorValueCents: 5_000, daysSinceLastActive: 2 });
    expect(donor).toBeGreaterThan(0);
  });

  it('caps at 100 and never goes negative', () => {
    const max = computeLeadScore({
      donationCount: 50, donorValueCents: 10_000_000, hasRecurring: true,
      campaignsCreated: 20, campaignsPublished: 10, eventsLast30d: 100, daysSinceLastActive: 0,
    });
    expect(max).toBeLessThanOrEqual(100);
    expect(computeLeadScore(base)).toBeGreaterThanOrEqual(0);
  });

  it('halves the score for long-inactive contacts', () => {
    const active = computeLeadScore({ ...base, donationCount: 3, daysSinceLastActive: 5 });
    const dormant = computeLeadScore({ ...base, donationCount: 3, daysSinceLastActive: 90 });
    expect(dormant).toBeLessThan(active);
  });

  it('recurring donors get a significant boost', () => {
    const oneOff = computeLeadScore({ ...base, donationCount: 1, daysSinceLastActive: 1 });
    const recurring = computeLeadScore({ ...base, donationCount: 1, hasRecurring: true, daysSinceLastActive: 1 });
    expect(recurring - oneOff).toBeGreaterThanOrEqual(15);
  });
});

describe('computeEngagementScore', () => {
  it('rewards recent activity', () => {
    const today = computeEngagementScore({ ...base, eventsLast30d: 3, daysSinceLastActive: 0 });
    const lastMonth = computeEngagementScore({ ...base, eventsLast30d: 3, daysSinceLastActive: 28 });
    expect(today).toBeGreaterThan(lastMonth);
  });

  it('caps never-active contacts low', () => {
    expect(computeEngagementScore({ ...base, eventsLast30d: 50 })).toBeLessThanOrEqual(20);
  });
});

describe('computeChurnRisk', () => {
  it('classifies by recency', () => {
    expect(computeChurnRisk({ ...base, daysSinceLastActive: 3 })).toBe('low');
    expect(computeChurnRisk({ ...base, daysSinceLastActive: 30 })).toBe('medium');
    expect(computeChurnRisk({ ...base, daysSinceLastActive: 90 })).toBe('high');
    expect(computeChurnRisk(base)).toBe('unknown');
  });
});

describe('classifyClientType', () => {
  it('recurring beats high-value beats repeat beats donor', () => {
    expect(classifyClientType({ ...base, hasRecurring: true, donorValueCents: 100_000 }, 'visitor')).toBe('recurring_donor');
    expect(classifyClientType({ ...base, donorValueCents: 60_000, donationCount: 3 }, 'visitor')).toBe('high_value_donor');
    expect(classifyClientType({ ...base, donationCount: 2 }, 'visitor')).toBe('repeat_donor');
    expect(classifyClientType({ ...base, donationCount: 1 }, 'visitor')).toBe('donor');
  });

  it('organizer classification from campaigns', () => {
    expect(classifyClientType({ ...base, campaignsPublished: 1, campaignsCreated: 1 }, 'visitor')).toBe('organizer');
    expect(classifyClientType({ ...base, campaignsCreated: 1 }, 'visitor')).toBe('draft_organizer');
  });

  it('keeps current type when no signals', () => {
    expect(classifyClientType(base, 'newsletter')).toBe('newsletter');
  });
});

describe('computeLifecycleStage', () => {
  it('dormant overrides everything after 90 days', () => {
    expect(computeLifecycleStage({ ...base, donationCount: 5, daysSinceLastActive: 120 })).toBe('dormant');
  });
  it('champion for 3+ donations or recurring', () => {
    expect(computeLifecycleStage({ ...base, donationCount: 3, daysSinceLastActive: 5 })).toBe('champion');
    expect(computeLifecycleStage({ ...base, hasRecurring: true, daysSinceLastActive: 5 })).toBe('champion');
  });
  it('subscriber → lead → engaged ladder by events', () => {
    expect(computeLifecycleStage({ ...base, daysSinceLastActive: 5 })).toBe('subscriber');
    expect(computeLifecycleStage({ ...base, eventsLast30d: 1, daysSinceLastActive: 5 })).toBe('lead');
    expect(computeLifecycleStage({ ...base, eventsLast30d: 3, daysSinceLastActive: 5 })).toBe('engaged');
  });
});

describe('matchesSegment', () => {
  const contact: SegmentableContact = {
    donation_count: 2,
    donor_value_cents: 60_000,
    lead_score: 70,
    engagement_score: 40,
    client_type: 'repeat_donor',
    lifecycle_stage: 'customer',
    country: 'US',
    last_active_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    event_types: ['donation_started', 'donation_completed', 'page_viewed'],
  };

  it('AND logic requires all conditions', () => {
    const rules: SegmentRules = {
      logic: 'and',
      conditions: [
        { field: 'donation_count', op: 'gte', value: 2 },
        { field: 'client_type', op: 'eq', value: 'repeat_donor' },
      ],
    };
    expect(matchesSegment(contact, rules)).toBe(true);
    expect(matchesSegment({ ...contact, donation_count: 1 }, rules)).toBe(false);
  });

  it('OR logic requires any condition', () => {
    const rules: SegmentRules = {
      logic: 'or',
      conditions: [
        { field: 'donation_count', op: 'gte', value: 100 },
        { field: 'country', op: 'eq', value: 'US' },
      ],
    };
    expect(matchesSegment(contact, rules)).toBe(true);
  });

  it('event has / not_has', () => {
    const abandoned: SegmentRules = {
      logic: 'and',
      conditions: [
        { field: 'event', op: 'has', value: 'donation_started' },
        { field: 'event', op: 'not_has', value: 'donation_completed' },
      ],
    };
    expect(matchesSegment(contact, abandoned)).toBe(false); // completed
    expect(matchesSegment({ ...contact, event_types: ['donation_started'] }, abandoned)).toBe(true);
  });

  it('inactive_days uses last_active_at', () => {
    const dormant: SegmentRules = { logic: 'and', conditions: [{ field: 'inactive_days', op: 'gte', value: 60 }] };
    expect(matchesSegment(contact, dormant)).toBe(false); // active 10 days ago
    const old = { ...contact, last_active_at: new Date(Date.now() - 100 * 86_400_000).toISOString() };
    expect(matchesSegment(old, dormant)).toBe(true);
    expect(matchesSegment({ ...contact, last_active_at: null }, dormant)).toBe(true); // never active
  });

  it('empty rules match nothing', () => {
    expect(matchesSegment(contact, { logic: 'and', conditions: [] })).toBe(false);
  });
});
