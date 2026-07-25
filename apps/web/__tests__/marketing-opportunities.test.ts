import { describe, it, expect } from 'vitest';
import { scoreOpportunity } from '../lib/marketing-opportunities';

describe('scoreOpportunity', () => {
  it('returns a bounded 0..100 integer', () => {
    const s = scoreOpportunity({ estImpactCents: 500_000, confidence: 0.7, effort: 'medium' });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(Number.isInteger(s)).toBe(true);
  });

  it('scores higher impact above lower impact, all else equal', () => {
    const lo = scoreOpportunity({ estImpactCents: 10_000, confidence: 0.6, effort: 'medium' });
    const hi = scoreOpportunity({ estImpactCents: 5_000_000, confidence: 0.6, effort: 'medium' });
    expect(hi).toBeGreaterThan(lo);
  });

  it('penalizes higher effort', () => {
    const low = scoreOpportunity({ estImpactCents: 500_000, confidence: 0.7, effort: 'low' });
    const high = scoreOpportunity({ estImpactCents: 500_000, confidence: 0.7, effort: 'high' });
    expect(low).toBeGreaterThan(high);
  });

  it('rewards urgency', () => {
    const calm = scoreOpportunity({ estImpactCents: 500_000, confidence: 0.7, effort: 'medium', urgency: 0 });
    const urgent = scoreOpportunity({ estImpactCents: 500_000, confidence: 0.7, effort: 'medium', urgency: 1 });
    expect(urgent).toBeGreaterThan(calm);
  });

  it('handles zero/negative impact without going out of range', () => {
    expect(scoreOpportunity({ estImpactCents: 0, confidence: 0, effort: 'high' })).toBe(0);
    expect(scoreOpportunity({ estImpactCents: null, confidence: 1, effort: 'low', urgency: 1 })).toBeLessThanOrEqual(100);
  });
});
