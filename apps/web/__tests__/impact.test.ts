import { describe, expect, it } from 'vitest';
import {
  sumPlanned,
  sumSpent,
  budgetProgress,
  metricProgress,
  transparencyScore,
  PlanUpsertSchema,
  UpdateCreateSchema,
  MetricCreateSchema,
} from '../lib/impact-core';

describe('budget helpers', () => {
  const items = [
    { planned_amount_cents: 10000, spent_amount_cents: 4000 },
    { planned_amount_cents: 5000, spent_amount_cents: 5000 },
  ];
  it('sums planned and spent', () => {
    expect(sumPlanned(items)).toBe(15000);
    expect(sumSpent(items)).toBe(9000);
  });
  it('computes clamped budget progress', () => {
    expect(budgetProgress(15000, 9000)).toBe(60);
    expect(budgetProgress(0, 100)).toBe(100);
    expect(budgetProgress(0, 0)).toBe(0);
    expect(budgetProgress(100, 500)).toBe(100);
  });
});

describe('metricProgress', () => {
  it('returns null without a positive target', () => {
    expect(metricProgress({ target_value: null, current_value: 5 })).toBeNull();
    expect(metricProgress({ target_value: 0, current_value: 5 })).toBeNull();
  });
  it('computes clamped percentage toward target', () => {
    expect(metricProgress({ target_value: 200, current_value: 50 })).toBe(25);
    expect(metricProgress({ target_value: 100, current_value: 250 })).toBe(100);
  });
});

describe('transparencyScore', () => {
  it('scores an empty campaign at 0 / Building', () => {
    const r = transparencyScore({
      hasPublishedPlan: false, totalBudgetCents: 0, totalSpentCents: 0,
      publishedUpdateCount: 0, updatesWithEvidenceCount: 0, metricCount: 0,
    });
    expect(r.score).toBe(0);
    expect(r.rating).toBe('Building');
  });
  it('rewards a fully-tracked campaign near 100 / Exceptional', () => {
    const r = transparencyScore({
      hasPublishedPlan: true, totalBudgetCents: 10000, totalSpentCents: 10000,
      publishedUpdateCount: 4, updatesWithEvidenceCount: 4, metricCount: 3,
    });
    expect(r.score).toBe(100);
    expect(r.rating).toBe('Exceptional');
  });
  it('caps each factor at its max', () => {
    const r = transparencyScore({
      hasPublishedPlan: true, totalBudgetCents: 100, totalSpentCents: 100000,
      publishedUpdateCount: 99, updatesWithEvidenceCount: 99, metricCount: 99,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    for (const f of r.factors) expect(f.points).toBeLessThanOrEqual(f.max);
  });
  it('gives partial credit for spend without a budget', () => {
    const r = transparencyScore({
      hasPublishedPlan: true, totalBudgetCents: 0, totalSpentCents: 5000,
      publishedUpdateCount: 0, updatesWithEvidenceCount: 0, metricCount: 0,
    });
    expect(r.score).toBe(20 + 15); // plan + partial spend
  });
  it('ratings cross the documented thresholds', () => {
    const strong = transparencyScore({
      hasPublishedPlan: true, totalBudgetCents: 100, totalSpentCents: 100,
      publishedUpdateCount: 4, updatesWithEvidenceCount: 2, metricCount: 1,
    });
    expect(strong.score).toBeGreaterThanOrEqual(75);
    expect(strong.rating).toBe('Strong');
  });
});

describe('validation schemas', () => {
  it('accepts a valid plan upsert', () => {
    const r = PlanUpsertSchema.safeParse({
      campaign_id: crypto.randomUUID(),
      items: [{ label: 'Supplies', planned_amount_cents: 10000, spent_amount_cents: 0 }],
    });
    expect(r.success).toBe(true);
  });
  it('requires a campaign uuid for updates', () => {
    expect(UpdateCreateSchema.safeParse({ campaign_id: 'nope', title: 'Hi there', body: 'Body text' }).success).toBe(false);
  });
  it('validates evidence urls', () => {
    const bad = UpdateCreateSchema.safeParse({
      campaign_id: crypto.randomUUID(), title: 'Update', body: 'Body',
      evidence: [{ kind: 'link', url: 'not-a-url' }],
    });
    expect(bad.success).toBe(false);
  });
  it('defaults metric current_value to 0', () => {
    const r = MetricCreateSchema.safeParse({ campaign_id: crypto.randomUUID(), label: 'Meals' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.current_value).toBe(0);
  });
});

// ── RLS policy logic simulation ───────────────────────────────────────────────
describe('impact_updates RLS: read scope', () => {
  function canRead(update: { status: string; owns: boolean }, isAdmin: boolean): boolean {
    return update.status === 'published' || update.owns || isAdmin;
  }
  it('anyone can read a published update', () => {
    expect(canRead({ status: 'published', owns: false }, false)).toBe(true);
  });
  it('drafts are hidden from non-owners', () => {
    expect(canRead({ status: 'draft', owns: false }, false)).toBe(false);
  });
  it('the campaign owner sees their drafts', () => {
    expect(canRead({ status: 'draft', owns: true }, false)).toBe(true);
  });
});
