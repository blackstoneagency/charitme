import { describe, expect, it } from 'vitest';
import {
  isAcceptingRequests,
  fundingProgress,
  canTransitionRequest,
  committedAmountDelta,
  OpportunityCreateSchema,
  RequestCreateSchema,
  type RequestStatus,
} from '../lib/sponsorships-core';

describe('isAcceptingRequests', () => {
  it('accepts only when open', () => {
    expect(isAcceptingRequests({ status: 'open' })).toBe(true);
    expect(isAcceptingRequests({ status: 'closed' })).toBe(false);
    expect(isAcceptingRequests({ status: 'draft' })).toBe(false);
    expect(isAcceptingRequests({ status: 'fulfilled' })).toBe(false);
  });
});

describe('fundingProgress', () => {
  it('returns null when no target is set', () => {
    expect(fundingProgress({ raised_amount_cents: 500, target_amount_cents: null })).toBeNull();
    expect(fundingProgress({ raised_amount_cents: 500, target_amount_cents: 0 })).toBeNull();
  });
  it('computes a clamped percentage', () => {
    expect(fundingProgress({ raised_amount_cents: 2500, target_amount_cents: 10000 })).toBe(25);
    expect(fundingProgress({ raised_amount_cents: 15000, target_amount_cents: 10000 })).toBe(100);
  });
});

describe('request state machine', () => {
  it('lets an organizer accept/decline a pending request', () => {
    expect(canTransitionRequest('organizer', 'pending', 'accepted')).toBe(true);
    expect(canTransitionRequest('organizer', 'pending', 'declined')).toBe(true);
  });
  it('lets an organizer fulfill an accepted request', () => {
    expect(canTransitionRequest('organizer', 'accepted', 'fulfilled')).toBe(true);
  });
  it('lets a sponsor withdraw while pending or accepted', () => {
    expect(canTransitionRequest('sponsor', 'pending', 'withdrawn')).toBe(true);
    expect(canTransitionRequest('sponsor', 'accepted', 'withdrawn')).toBe(true);
  });
  it('forbids a sponsor accepting their own request', () => {
    expect(canTransitionRequest('sponsor', 'pending', 'accepted')).toBe(false);
  });
  it('forbids reviving a terminal request', () => {
    expect(canTransitionRequest('organizer', 'declined', 'accepted')).toBe(false);
    expect(canTransitionRequest('organizer', 'fulfilled', 'accepted')).toBe(false);
  });
});

describe('committedAmountDelta', () => {
  const cases: [RequestStatus, RequestStatus, number][] = [
    ['pending', 'accepted', 5000],
    ['accepted', 'declined', -5000],
    ['accepted', 'withdrawn', -5000],
    ['accepted', 'fulfilled', 0],
    ['pending', 'declined', 0],
  ];
  it.each(cases)('%s -> %s moves committed by %d', (from, to, expected) => {
    expect(committedAmountDelta(from, to, 5000)).toBe(expected);
  });
});

describe('validation schemas', () => {
  it('accepts a valid opportunity', () => {
    const r = OpportunityCreateSchema.safeParse({
      title: 'Sponsor our season',
      description: 'Community youth soccer team seeking local sponsors for the spring season.',
      min_amount_cents: 10000,
    });
    expect(r.success).toBe(true);
  });
  it('rejects a request below the $1 floor', () => {
    expect(RequestCreateSchema.safeParse({ opportunity_id: crypto.randomUUID(), amount_cents: 50 }).success).toBe(false);
    expect(RequestCreateSchema.safeParse({ opportunity_id: crypto.randomUUID(), amount_cents: 100 }).success).toBe(true);
  });
});

// ── RLS policy logic simulation (mirrors the SQL policies) ────────────────────
describe('sponsorship_requests RLS: read scope', () => {
  function canRead(
    req: { sponsor_id: string; organizer_id: string },
    uid: string | null,
    isAdmin: boolean,
  ): boolean {
    return req.sponsor_id === uid || isAdmin || req.organizer_id === uid;
  }
  it('the sponsor can read their own request', () => {
    expect(canRead({ sponsor_id: 's1', organizer_id: 'o1' }, 's1', false)).toBe(true);
  });
  it('the organizer can read offers to their opportunity', () => {
    expect(canRead({ sponsor_id: 's1', organizer_id: 'o1' }, 'o1', false)).toBe(true);
  });
  it('an unrelated user cannot read the request', () => {
    expect(canRead({ sponsor_id: 's1', organizer_id: 'o1' }, 'stranger', false)).toBe(false);
  });
});
