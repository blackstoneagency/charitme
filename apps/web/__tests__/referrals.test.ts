import { describe, expect, it } from 'vitest';
import { getReferralTier, REFERRAL_TIERS } from '../lib/referrals';

describe('getReferralTier', () => {
  it('places 0 conversions in the first tier (Connector)', () => {
    const t = getReferralTier(0);
    expect(t.current.name).toBe('Connector');
    expect(t.next?.name).toBe('Advocate');
    expect(t.remaining).toBe(3);
    expect(t.progress).toBe(0);
  });

  it('picks the highest tier whose threshold is met', () => {
    expect(getReferralTier(2).current.name).toBe('Connector'); // below Advocate(3)
    expect(getReferralTier(3).current.name).toBe('Advocate');
    expect(getReferralTier(9).current.name).toBe('Advocate'); // below Influencer(10)
    expect(getReferralTier(10).current.name).toBe('Influencer');
    expect(getReferralTier(25).current.name).toBe('Ambassador');
    expect(getReferralTier(49).current.name).toBe('Ambassador');
    expect(getReferralTier(50).current.name).toBe('Champion');
  });

  it('computes fractional progress toward the next tier', () => {
    // 5 conversions in Advocate[3]..Influencer[10]: (5-3)/(10-3) = 2/7
    const t = getReferralTier(5);
    expect(t.current.name).toBe('Advocate');
    expect(t.next?.name).toBe('Influencer');
    expect(t.progress).toBeCloseTo(2 / 7, 5);
    expect(t.remaining).toBe(5); // 10 - 5
  });

  it('caps the top tier (Champion) at full progress with no next', () => {
    const t = getReferralTier(120);
    expect(t.current.name).toBe('Champion');
    expect(t.next).toBeNull();
    expect(t.progress).toBe(1);
    expect(t.remaining).toBe(0);
  });

  it('clamps negative/garbage conversion counts to the first tier', () => {
    const t = getReferralTier(-5);
    expect(t.current.name).toBe('Connector'); // never drops below the first tier
    expect(t.progress).toBe(0);               // progress clamped to 0
  });

  it('progress is monotonic non-decreasing within a tier span', () => {
    // Within Advocate[3]..just-below-Influencer[10] (crossing 10 resets to a new tier).
    let prev = -1;
    for (let c = 3; c < 10; c++) {
      const p = getReferralTier(c).progress;
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('every tier boundary resolves to that exact tier', () => {
    for (const tier of REFERRAL_TIERS) {
      expect(getReferralTier(tier.minConversions).current.name).toBe(tier.name);
    }
  });
});
