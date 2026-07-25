import { describe, it, expect } from 'vitest';
import { percentile, roundToNiceAmount, buildGoalGuidance, MIN_SAMPLE } from '../lib/goal-guidance';

describe('percentile', () => {
  it('returns null for an empty list and the value for a single item', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([42], 0.9)).toBe(42);
  });

  it('computes the median regardless of input order', () => {
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('interpolates between neighbours and clamps out-of-range p', () => {
    expect(percentile([0, 10], 0.25)).toBe(2.5);
    expect(percentile([1, 2, 3], -1)).toBe(1);
    expect(percentile([1, 2, 3], 5)).toBe(3);
  });

  it('ignores non-finite values', () => {
    expect(percentile([1, NaN, 3], 0.5)).toBe(2);
  });
});

describe('roundToNiceAmount', () => {
  it('never suggests an ugly figure', () => {
    for (const cents of [743_100, 1_234_500, 99_900, 12_345]) {
      const out = roundToNiceAmount(cents);
      expect(out % 100).toBe(0);              // whole dollars
      expect(out).toBeGreaterThan(0);
    }
  });

  it('floors at a sane minimum and handles zero/negative', () => {
    expect(roundToNiceAmount(0)).toBe(0);
    expect(roundToNiceAmount(-5)).toBe(0);
    expect(roundToNiceAmount(100)).toBeGreaterThanOrEqual(5000);
  });
});

describe('buildGoalGuidance', () => {
  const rows = (goals: number[], raised: number[] = []) =>
    goals.map((g, i) => ({ goal_amount: g, raised_amount: raised[i] ?? 0 }));

  it('withholds guidance below the minimum sample rather than guessing', () => {
    const g = buildGoalGuidance(rows([100_000, 200_000]));
    expect(g.available).toBe(false);
    expect(g.lowCents).toBeNull();
    expect(g.sampleSize).toBe(2);
    expect(g.note).toMatch(/not enough/i);
  });

  it('produces an ordered range once there is enough data', () => {
    const g = buildGoalGuidance(rows([100_000, 200_000, 300_000, 400_000, 500_000, 600_000]));
    expect(g.available).toBe(true);
    expect(g.sampleSize).toBe(6);
    expect(g.lowCents!).toBeLessThanOrEqual(g.highCents!);
    expect(g.medianGoalCents).toBeGreaterThan(0);
  });

  it('computes the goal hit rate from real raised amounts', () => {
    // 3 of 6 reached their goal
    const g = buildGoalGuidance(rows(
      [100, 100, 100, 100, 100, 100].map((n) => n * 1000),
      [100, 100, 100, 10, 10, 10].map((n) => n * 1000),
    ));
    expect(g.goalHitRate).toBeCloseTo(0.5, 5);
  });

  it('ignores zero and negative goals when sizing the sample', () => {
    const g = buildGoalGuidance(rows([0, -5, 100_000, 200_000]));
    expect(g.sampleSize).toBe(2);
    expect(g.available).toBe(false);
  });

  it('treats MIN_SAMPLE as the inclusive threshold', () => {
    const g = buildGoalGuidance(rows(Array.from({ length: MIN_SAMPLE }, (_, i) => (i + 1) * 100_000)));
    expect(g.available).toBe(true);
  });
});
