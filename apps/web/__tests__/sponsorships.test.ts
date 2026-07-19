import { describe, expect, it } from 'vitest';
import {
  allowedSponsorshipTransition,
  canTransitionSponsorship,
  isSponsorshipRequestStatus,
  isValidSponsorshipAmount,
  remainingSponsorshipSlots,
  sponsorshipStatusLabel,
  SPONSORSHIP_REQUEST_STATUSES,
} from '../lib/sponsorships';

describe('sponsorship request state machine', () => {
  it('allows documented transitions', () => {
    expect(canTransitionSponsorship('pending', 'accepted')).toBe(true);
    expect(canTransitionSponsorship('accepted', 'agreed')).toBe(true);
    expect(canTransitionSponsorship('agreed', 'fulfilled')).toBe(true);
    expect(canTransitionSponsorship('pending', 'withdrawn')).toBe(true);
  });
  it('blocks terminal + illegal transitions', () => {
    expect(canTransitionSponsorship('fulfilled', 'pending')).toBe(false);
    expect(canTransitionSponsorship('pending', 'fulfilled')).toBe(false);
    expect(canTransitionSponsorship('declined', 'accepted')).toBe(false);
  });
});

describe('actor-scoped sponsorship transitions', () => {
  it('sponsor may withdraw or confirm agreement', () => {
    expect(allowedSponsorshipTransition('sponsor', 'pending', 'withdrawn')).toBe(true);
    expect(allowedSponsorshipTransition('sponsor', 'accepted', 'agreed')).toBe(true);
    expect(allowedSponsorshipTransition('sponsor', 'pending', 'accepted')).toBe(false);
  });
  it('organizer may accept/decline/fulfill', () => {
    expect(allowedSponsorshipTransition('organizer', 'pending', 'accepted')).toBe(true);
    expect(allowedSponsorshipTransition('organizer', 'pending', 'declined')).toBe(true);
    expect(allowedSponsorshipTransition('organizer', 'agreed', 'fulfilled')).toBe(true);
    expect(allowedSponsorshipTransition('organizer', 'accepted', 'agreed')).toBe(false);
  });
  it('admin may do any valid transition', () => {
    expect(allowedSponsorshipTransition('admin', 'accepted', 'agreed')).toBe(true);
    expect(allowedSponsorshipTransition('admin', 'fulfilled', 'pending')).toBe(false);
  });
});

describe('amount + slot helpers', () => {
  it('validates amount against minimum', () => {
    expect(isValidSponsorshipAmount(10_000, 5_000)).toBe(true);
    expect(isValidSponsorshipAmount(4_999, 5_000)).toBe(false);
    expect(isValidSponsorshipAmount(-1, 0)).toBe(false);
  });
  it('computes remaining slots, never negative', () => {
    expect(remainingSponsorshipSlots(3, 1)).toBe(2);
    expect(remainingSponsorshipSlots(2, 5)).toBe(0);
  });
});

describe('status helpers', () => {
  it('validates statuses', () => {
    expect(isSponsorshipRequestStatus('agreed')).toBe(true);
    expect(isSponsorshipRequestStatus('nope')).toBe(false);
  });
  it('labels every status', () => {
    for (const s of SPONSORSHIP_REQUEST_STATUSES) expect(sponsorshipStatusLabel(s)).toBeTruthy();
  });
});
