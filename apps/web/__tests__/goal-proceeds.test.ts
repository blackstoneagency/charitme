import { describe, it, expect } from 'vitest';
import { goalProceeds } from '../lib/goal-proceeds';
import { processingFee, PLATFORM_FEE_PERCENT } from '@shared/fees';

describe('goalProceeds', () => {
  it('takes a 0% platform fee — organizer keeps the full goal before processing', () => {
    const p = goalProceeds(10_000_00);
    expect(PLATFORM_FEE_PERCENT).toBe(0);
    expect(p.platformFeeCents).toBe(0);
    expect(p.platformFeePercent).toBe(0);
    expect(p.keptBeforeProcessingCents).toBe(10_000_00);
  });

  it('matches @shared/fees processingFee for the single-transaction estimate', () => {
    const goal = 10_000_00;
    const p = goalProceeds(goal);
    expect(p.estProcessingCents).toBe(processingFee(goal));
    expect(p.estNetCents).toBe(goal - processingFee(goal));
  });

  it('handles zero / falsy goal without dividing by zero or going negative', () => {
    const p = goalProceeds(0);
    expect(p.goalCents).toBe(0);
    expect(p.estProcessingCents).toBe(0);
    expect(p.estNetCents).toBe(0);
    expect(goalProceeds(NaN).goalCents).toBe(0);
  });

  it('never returns a negative net', () => {
    const p = goalProceeds(1);
    expect(p.estNetCents).toBeGreaterThanOrEqual(0);
  });

  it('rounds a fractional cents goal and exposes a readable processing rate', () => {
    const p = goalProceeds(5_000_49);
    expect(Number.isInteger(p.goalCents)).toBe(true);
    expect(p.processingRateLabel).toBe('2.9% + $0.30');
  });
});
