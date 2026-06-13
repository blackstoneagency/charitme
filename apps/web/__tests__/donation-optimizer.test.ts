import { describe, it, expect } from 'vitest';
import { optimizeAsks, computeImpact } from '../lib/donation-optimizer';

const day = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();

describe('optimizeAsks', () => {
  it('returns 6 ascending unique presets', () => {
    const { presets } = optimizeAsks({ goalCents: 500_000, raisedCents: 50_000, backerCount: 8, createdAt: iso(5) });
    expect(presets).toHaveLength(6);
    expect([...presets].sort((a, b) => a - b)).toEqual(presets);
    expect(new Set(presets).size).toBe(6);
  });

  it('recommended is one of the presets', () => {
    const r = optimizeAsks({ goalCents: 1_000_000, raisedCents: 0, backerCount: 0, createdAt: iso(1) });
    expect(r.presets).toContain(r.recommended);
  });

  it('scales asks down for small goals', () => {
    const small = optimizeAsks({ goalCents: 50_000, raisedCents: 0, backerCount: 0, createdAt: iso(1) }); // $500 goal
    expect(small.presets[0]).toBeLessThanOrEqual(25);
    expect(small.presets[5]).toBeLessThanOrEqual(1000);
  });

  it('scales asks up for large goals', () => {
    const large = optimizeAsks({ goalCents: 50_000_000, raisedCents: 0, backerCount: 0, createdAt: iso(1) }); // $500k goal
    expect(large.presets[1]).toBeGreaterThanOrEqual(100);
  });

  it('anchors on average gift when backers exist', () => {
    // $10,000 raised across 100 backers → $100 average
    const r = optimizeAsks({ goalCents: 5_000_000, raisedCents: 1_000_000, backerCount: 100, createdAt: iso(10) });
    expect(r.presets).toContain(100);
  });

  it('offers a finish-it ask when campaign is nearly funded', () => {
    // $1,000 goal, $900 raised → $100 remaining should appear
    const r = optimizeAsks({ goalCents: 100_000, raisedCents: 90_000, backerCount: 20, createdAt: iso(10) });
    expect(r.presets).toContain(100);
  });

  it('never produces asks below $5', () => {
    const r = optimizeAsks({ goalCents: 100, raisedCents: 0, backerCount: 0, createdAt: iso(1) });
    expect(Math.min(...r.presets)).toBeGreaterThanOrEqual(5);
  });
});

describe('computeImpact', () => {
  it('reports 100% and zero days remaining when funded', () => {
    const i = computeImpact({ goalCents: 100_000, raisedCents: 100_000, backerCount: 30, createdAt: iso(10) });
    expect(i.percentFunded).toBe(100);
    expect(i.projectedDaysToGoal).toBe(0);
  });

  it('projects days to goal from velocity', () => {
    // $100/day for 10 days = $1,000 raised; $1,000 remaining → ~10 days
    const i = computeImpact({ goalCents: 200_000, raisedCents: 100_000, backerCount: 10, createdAt: iso(10) });
    expect(i.projectedDaysToGoal).toBeGreaterThanOrEqual(9);
    expect(i.projectedDaysToGoal).toBeLessThanOrEqual(11);
  });

  it('returns null projection when velocity is negligible', () => {
    const i = computeImpact({ goalCents: 1_000_000, raisedCents: 100, backerCount: 1, createdAt: iso(30) });
    expect(i.projectedDaysToGoal).toBeNull();
  });

  it('labels new campaigns as starting', () => {
    const i = computeImpact({ goalCents: 100_000, raisedCents: 0, backerCount: 0, createdAt: iso(0) });
    expect(i.momentum).toBe('starting');
  });

  it('labels active campaigns with backers as steady or surging', () => {
    const i = computeImpact({ goalCents: 100_000, raisedCents: 50_000, backerCount: 25, createdAt: iso(3) });
    expect(['steady', 'surging']).toContain(i.momentum);
  });
});
