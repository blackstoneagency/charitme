import { describe, it, expect } from 'vitest';
import {
  canRead,
  redactPost,
  redactPosts,
  isMembershipActive,
  type RawPost,
  type ViewerMembership,
} from '../lib/creator-posts';

// Access control that fails OPEN does not throw, does not 500, and does not look
// wrong on screen — it just publishes paid content. Nothing else in the suite
// would catch it, so the gate is tested directly and the body is asserted absent
// rather than merely unrendered.

const post = (over: Partial<RawPost> = {}): RawPost => ({
  id: 'p1',
  title: 'Behind the scenes',
  body: 'SECRET-BODY',
  visibility: 'members',
  minimum_tier_id: null,
  created_at: '2026-07-01T00:00:00.000Z',
  ...over,
});

const TIER_PRICES = new Map([['t-small', 500], ['t-big', 5000]]);
const TIER_TITLES = new Map([['t-small', 'Supporter'], ['t-big', 'Producer']]);
const member = (tierId: string, amountCents: number): ViewerMembership => ({ tierId, amountCents });

describe('creator post gating', () => {
  it('lets anyone read a public post', () => {
    expect(canRead(post({ visibility: 'public' }), [], TIER_PRICES)).toBe(true);
  });

  it('locks a members-only post for a signed-out or non-member viewer', () => {
    expect(canRead(post({ visibility: 'members' }), [], TIER_PRICES)).toBe(false);
  });

  it('opens a members-only post to any active member', () => {
    expect(canRead(post({ visibility: 'members' }), [member('t-small', 500)], TIER_PRICES)).toBe(true);
  });

  it('compares tier gates by PRICE, not tier identity', () => {
    const gated = post({ visibility: 'tier', minimum_tier_id: 't-big' });
    // On the cheap tier — below the gate.
    expect(canRead(gated, [member('t-small', 500)], TIER_PRICES)).toBe(false);
    // On the exact tier.
    expect(canRead(gated, [member('t-big', 5000)], TIER_PRICES)).toBe(true);
    // On a HIGHER tier that is not the named one — must still pass, or every
    // top-tier member is locked out of mid-tier posts.
    expect(canRead(gated, [member('t-vip', 10000)], TIER_PRICES)).toBe(true);
  });

  it('denies rather than grants when the required tier price is unknown', () => {
    const gated = post({ visibility: 'tier', minimum_tier_id: 't-deleted' });
    expect(canRead(gated, [member('t-big', 5000)], TIER_PRICES)).toBe(false);
  });

  it('treats a tier-gated post with no tier named as members-only, not public', () => {
    const underSpecified = post({ visibility: 'tier', minimum_tier_id: null });
    expect(canRead(underSpecified, [], TIER_PRICES)).toBe(false);
    expect(canRead(underSpecified, [member('t-small', 500)], TIER_PRICES)).toBe(true);
  });

  it('always lets the author read their own post', () => {
    expect(canRead(post({ visibility: 'tier', minimum_tier_id: 't-big' }), [], TIER_PRICES, true)).toBe(true);
  });

  describe('redaction — the body must not leave the server', () => {
    it('omits the body entirely from a locked post', () => {
      const out = redactPost(post(), [], TIER_PRICES, TIER_TITLES);
      expect(out.locked).toBe(true);
      expect('body' in out).toBe(false);
      // The real assertion: the secret is nowhere in the serialized payload.
      expect(JSON.stringify(out)).not.toContain('SECRET-BODY');
    });

    it('includes the body when unlocked', () => {
      const out = redactPost(post(), [member('t-small', 500)], TIER_PRICES, TIER_TITLES);
      expect(out.locked).toBe(false);
      expect(JSON.stringify(out)).toContain('SECRET-BODY');
    });

    it('names the required tier in the lock reason without leaking the body', () => {
      const out = redactPost(post({ visibility: 'tier', minimum_tier_id: 't-big' }), [], TIER_PRICES, TIER_TITLES);
      expect(out.locked && out.lockReason).toContain('Producer');
      expect(JSON.stringify(out)).not.toContain('SECRET-BODY');
    });

    it('redacts a whole feed without leaking any locked body', () => {
      const feed = [
        post({ id: 'a', visibility: 'public', body: 'PUBLIC-BODY' }),
        post({ id: 'b', visibility: 'members', body: 'SECRET-BODY' }),
        post({ id: 'c', visibility: 'tier', minimum_tier_id: 't-big', body: 'SECRET-BODY' }),
      ];
      const json = JSON.stringify(redactPosts(feed, [], TIER_PRICES, TIER_TITLES));
      expect(json).toContain('PUBLIC-BODY');
      expect(json).not.toContain('SECRET-BODY');
    });
  });

  describe('membership activity', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();

    it('counts an active subscription inside its paid period', () => {
      expect(isMembershipActive({ status: 'active', current_period_end: future })).toBe(true);
    });

    it('drops an active subscription whose period has lapsed', () => {
      expect(isMembershipActive({ status: 'active', current_period_end: past })).toBe(false);
    });

    it('does not grant access on past_due, paused or cancelled', () => {
      for (const status of ['past_due', 'paused', 'cancelled']) {
        expect(isMembershipActive({ status, current_period_end: future }), status).toBe(false);
      }
    });

    it('treats a null period end as no known lapse', () => {
      expect(isMembershipActive({ status: 'active', current_period_end: null })).toBe(true);
    });

    it('denies on an unparseable period end rather than granting', () => {
      expect(isMembershipActive({ status: 'active', current_period_end: 'not-a-date' })).toBe(false);
    });
  });
});
