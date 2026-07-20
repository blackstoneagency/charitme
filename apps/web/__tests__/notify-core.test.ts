import { describe, expect, it } from 'vitest';
import {
  sponsorshipOfferReceived,
  sponsorshipOfferResolved,
  matchingClaimReceived,
  matchingClaimResolved,
  eventRsvpReceived,
} from '../lib/notify-core';

describe('sponsorship notifications', () => {
  it('builds an offer-received draft with amount + title', () => {
    const d = sponsorshipOfferReceived('Acme Co.', '$500', 'Youth Soccer');
    expect(d.kind).toBe('sponsorship_offer');
    expect(d.title).toContain('$500');
    expect(d.body).toContain('Acme Co.');
    expect(d.body).toContain('Youth Soccer');
    expect(d.link).toBe('/sponsor/manage');
  });
  it('builds resolved drafts for accepted/declined/fulfilled and null otherwise', () => {
    expect(sponsorshipOfferResolved('accepted', 'Gala')?.kind).toBe('sponsorship_accepted');
    expect(sponsorshipOfferResolved('declined', 'Gala')?.body).toMatch(/declined/);
    expect(sponsorshipOfferResolved('fulfilled', 'Gala')?.title).toMatch(/fulfilled/);
    expect(sponsorshipOfferResolved('withdrawn', 'Gala')).toBeNull();
    expect(sponsorshipOfferResolved('pending', 'Gala')).toBeNull();
  });
});

describe('matching notifications', () => {
  it('builds a claim-received draft', () => {
    const d = matchingClaimReceived('$100', 'Acme Corp');
    expect(d.kind).toBe('matching_claim');
    expect(d.body).toContain('$100');
    expect(d.body).toContain('Acme Corp');
    expect(d.link).toBe('/matching/manage');
  });
  it('builds resolved drafts for approved/declined/paid and null otherwise', () => {
    expect(matchingClaimResolved('approved', 'Acme')?.kind).toBe('matching_approved');
    expect(matchingClaimResolved('paid', 'Acme')?.title).toMatch(/paid/);
    expect(matchingClaimResolved('pending', 'Acme')).toBeNull();
    expect(matchingClaimResolved('withdrawn', 'Acme')).toBeNull();
  });
});

describe('event notifications', () => {
  it('builds an rsvp draft naming attendee + event', () => {
    const d = eventRsvpReceived('Jane', 'Spring Gala');
    expect(d.kind).toBe('event_rsvp');
    expect(d.title).toContain('Spring Gala');
    expect(d.body).toContain('Jane');
    expect(d.link).toBe('/events/manage');
  });
});
